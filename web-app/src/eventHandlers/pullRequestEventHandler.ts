import { EventPayloads } from "@octokit/webhooks";
import { Context } from "probot";
import { DeprecatedLogger } from "probot/lib/types";
import { AppConfig } from "../models/appConfig";
import { AppSettings } from "../models/appSettings";
import { ConfigService } from "../services/configService";
import { GitHubService, OctokitPlus } from "../services/githubService";
import { HelperService } from "../services/helperService";
import { ParsedMarkdownDiscussion, ParserService } from "../services/parserService";
import { TokenService } from "../services/tokenService";

interface PullInfo {
  owner: string;
  repo: string;
  repoName: string;
  pull_number: number;
}

export class PullRequestEventHandler {
  private readonly errorIcon = "⛔️";
  private readonly approverPrefix = "To approve, @";
  private readonly approvalReaction = {
    icon: "🚀",
    label: "rocket",
  };

  private _tokenService: TokenService;
  private _configService: ConfigService;

  private constructor(tokenService: TokenService, configService: ConfigService) {
    this._tokenService = tokenService;
    this._configService = configService;
  }

  public static async build(context: Context<EventPayloads.WebhookPayloadPullRequest>, tokenService: TokenService) {
    const configService = await ConfigService.build(context.log, context);
    const appSettings = configService.appConfig.appSettings;
    if (!appSettings) {
      throw new Error("Make sure to build the config service with the webhook context");
    }
    if (!configService.appConfig.base_url) {
      throw new Error("Base URL is not set. Make sure router middleware was added");
    }
    return new PullRequestEventHandler(tokenService, configService);
  }

  public onOpened = async (context: Context<EventPayloads.WebhookPayloadPullRequest>): Promise<void> => {
    const logger = context.log;
    logger.info("Handling pull_request.opened event...");

    const appConfig = this._configService.appConfig;
    const appGitHubService = GitHubService.buildForApp(context.octokit as unknown as OctokitPlus, logger, appConfig);

    const payload = context.payload;
    const pullInfo: PullInfo = {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      repoName: payload.repository.name,
      pull_number: payload.pull_request.number,
    };

    const isDefaultBranch = payload.pull_request.base.ref === payload.repository.default_branch;

    if (!isDefaultBranch) {
      logger.info("The PR is not targeting the default branch, will not post anything");
      return;
    }

    const pullRequestFiles = await appGitHubService.getPullRequestFiles(pullInfo);

    const filesAdded = pullRequestFiles.filter((file) => file.status === "added");

    logger.debug(`Number of files added in push: ${filesAdded.length}`);

    const app = await this.getAuthenticatedApp(logger, context);
    const { appName, appPublicPage } = {
      appName: app.name,
      appPublicPage: app.html_url,
    };
    const appLinkMarkdown = `[@${appName}](${appPublicPage})`;

    // Example filepath: "docs/team-posts/hello-world.md"
    for (const file of filesAdded) {
      const filepath = file.filename;
      const shouldCreateDiscussionForFile = this.shouldCreateDiscussionForFile(appConfig.appSettings, filepath);
      if (shouldCreateDiscussionForFile) {
        try {
          const fileref = payload.pull_request.head.ref;
          // Parse the markdown to get the discussion metadata and details
          const parsedMarkdown = await this.getParsedMarkdownDiscussion(appGitHubService, logger, {
            filepath: filepath,
            pullInfo: pullInfo,
            fileref: fileref,
          });

          const authorLogin = parsedMarkdown.author;

          if (authorLogin !== payload.pull_request.user.login) {
            await appGitHubService.addPullRequestReviewers({
              ...pullInfo,
              reviewers: [authorLogin],
            });
          }

          if (!parsedMarkdown.repo && !parsedMarkdown.team) {
            throw new Error("Markdown is missing a repo or team to post the discussion to");
          }

          let commentBody = `⚠️ ${appLinkMarkdown} will create a discussion using this file once this PR is merged ⚠️
          \n${this.approverPrefix}${authorLogin} must react to this comment with a ${this.approvalReaction.icon}
\n\n**IMPORTANT**:`;

          const userRefreshToken = await this._tokenService.getRefreshToken({
            userLogin: authorLogin,
          });
          if (!userRefreshToken) {
            const fullAuthUrl = `${appConfig.base_url}${appConfig.auth_url}`;
            commentBody += `\n- @${authorLogin} must [authenticate](${fullAuthUrl}) before merging this PR`;
          }

          commentBody += `\n- Do not use relative links to files in your repo. Instead, use full URLs and for media drag/drop or paste the file into the markdown. The link generated for media should contain \`https://user-images.githubusercontent.com\``;

          await appGitHubService.createPullRequestComment({
            ...pullInfo,
            commit_id: payload.pull_request.head.sha,
            start_line: 1,
            end_line: 6,
            body: commentBody,
            filepath: filepath,
          });

          // Dry run createDiscussion to ensure it will work
          await this.createDiscussion(appGitHubService, logger, appConfig, {
            filepath: filepath,
            pullInfo: pullInfo,
            userToken: "dry_run",
            dryRun: true,
            fileref: fileref,
          });
        } catch (error) {
          const exceptionMessage = HelperService.getErrorMessage(error);
          logger.warn(exceptionMessage);
          const errorMessage = `${this.errorIcon} ${appLinkMarkdown} will not be able to create a discussion for this file. ${this.errorIcon}\n
Please fix the issues and recreate a new PR:
> ${exceptionMessage}
`;
          await appGitHubService.createPullRequestComment({
            ...pullInfo,
            commit_id: payload.pull_request.head.sha,
            start_line: 1,
            end_line: 6,
            body: errorMessage,
            filepath: filepath,
          });
        }
      }
    }
    logger.info("Exiting pull_request.opened handler");
  };

  public onMerged = async (context: Context<EventPayloads.WebhookPayloadPullRequest>): Promise<void> => {
    const logger = context.log;
    logger.info("Handling pull_request.closed and merged event...");

    const appConfig = this._configService.appConfig;
    const appGitHubService = GitHubService.buildForApp(context.octokit as unknown as OctokitPlus, logger, appConfig);

    const payload = context.payload;
    const pullInfo: PullInfo = {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      repoName: payload.repository.name,
      pull_number: payload.pull_request.number,
    };

    const isDefaultBranch = payload.pull_request.base.ref === payload.repository.default_branch;

    if (!isDefaultBranch) {
      logger.info("The PR is not targeting the default branch, will not post anything");
      return;
    }

    // 1. (Shortcut) Look for comments made by the app and which files they were made on
    const app = await this.getAuthenticatedApp(logger, context);
    const { appLogin, postFooter } = {
      appLogin: `${app.slug}[bot]`,
      postFooter: `\n\n> Published with ❤️&nbsp;by [${app.name}](${app.html_url})\n`,
    };

    const pullRequestComments = await appGitHubService.getPullRequestComments({
      ...pullInfo,
    });

    // Our app will skip it if our comment has been edited (for security)
    const botComments = pullRequestComments.filter(
      (comment) => comment.user.login === appLogin && !comment.in_reply_to_id && comment.path && !comment.body.includes(this.errorIcon)
    );

    if (botComments.length == 0) {
      logger.info(`No ${appLogin} comments found on this PR`);
      return;
    }

    // Get new tokens for all the users only once using their refresh tokens
    const userTokenCache: { [login: string]: string } = {};
    const users = botComments.map((comment) => this.getAuthorLogin(comment.body));
    const usersDistinct = Array.from(new Set(users));
    for (const userLogin of usersDistinct) {
      userTokenCache[userLogin] = await this._tokenService.refreshUserToken(userLogin);
    }

    // 2. Check for the approval reaction made by the author
    for (const fileToPostComment of botComments) {
      const authorLogin = this.getAuthorLogin(fileToPostComment.body);
      const reactions = await appGitHubService.getPullRequestCommentReaction({
        ...pullInfo,
        comment_id: fileToPostComment.id,
      });
      const authorApprovalReaction = reactions.find((reaction) => reaction.content === this.approvalReaction.label && reaction.user?.login === authorLogin);
      if (authorApprovalReaction) {
        logger.info("Found an approval!");
        // 3. Create the discussions based off of the file
        const filepath = fileToPostComment.path;
        const userToken = userTokenCache[authorLogin];
        try {
          await this.createDiscussion(appGitHubService, logger, appConfig, {
            filepath: filepath,
            pullInfo: pullInfo,
            userToken: userToken,
            dryRun: false,
            pullRequestCommentId: fileToPostComment.id,
            postFooter: postFooter,
          });
        } catch (err) {
          const errorMessage = HelperService.getErrorMessage(err);
          logger.error(errorMessage);
        }
      }
    }
    logger.info("Exiting pull_request.closed handler");
  };

  private getAuthorLogin(commentBody: string) {
    return commentBody.split(this.approverPrefix)[1].split(" ")[0];
  }

  private async getAuthenticatedApp(logger: DeprecatedLogger, context: Context<EventPayloads.WebhookPayloadPullRequest>) {
    logger.info(`Getting authenticated app...`);
    const authenticatedApp = await context.octokit.apps.getAuthenticated();
    logger.trace(`authenticatedApp:\n${JSON.stringify(authenticatedApp)}`);
    logger.info(`Done.`);
    return authenticatedApp.data;
  }

  private async getParsedMarkdownDiscussion(
    appGitHubService: GitHubService,
    logger: DeprecatedLogger,
    options: {
      filepath: string;
      pullInfo: PullInfo;
      fileref?: string;
    }
  ): Promise<ParsedMarkdownDiscussion> {
    const fileContent = await appGitHubService.getFileContent({
      path: options.filepath,
      ref: options.fileref,
      ...options.pullInfo,
    });
    logger.info(`Parsing the markdown information for ${options.filepath}...`);
    const parserService = ParserService.build(fileContent, logger);
    const parsedItems = parserService.parseDocument();
    return parsedItems;
  }

  private async createDiscussion(
    appGitHubService: GitHubService,
    logger: DeprecatedLogger,
    appConfig: AppConfig,
    options: {
      filepath: string;
      pullInfo: PullInfo;
      userToken: string;
      dryRun: boolean;
      postFooter?: string;
      fileref?: string;
      pullRequestCommentId?: number;
    }
  ) {
    logger.debug("Begin createDiscussion method...");
    const parsedItems = await this.getParsedMarkdownDiscussion(appGitHubService, logger, options);

    // Appending footer here because it's not really parsed from the markdown
    parsedItems.postBody += options.postFooter;

    logger.debug(`Parsed Document Items: ${JSON.stringify(parsedItems)}`);
    const { repo, repoOwner, team, teamOwner } = parsedItems;

    const userGithubService = GitHubService.buildForUser(options.userToken || "dry_run", logger, appConfig);

    // Check for repo to post to
    if (repo) {
      if (!repoOwner) {
        throw new Error("Missing target repo owner - repo url should include the owner (organization)");
      }

      if (
        !(await appGitHubService.appIsInstalled({
          owner: repoOwner,
        }))
      ) {
        throw new Error(`The app is not installed on the organization or user "${repoOwner}"`);
      }
      await this.createRepoDiscussion(appGitHubService, userGithubService, logger, {
        ...options,
        parsedItems,
      });
    }

    // Check for team to post to
    if (team) {
      if (!teamOwner) {
        throw new Error("The url to the team is not valid - it must include the team owner (organization)");
      }
      if (
        !(await appGitHubService.appIsInstalled({
          owner: teamOwner,
        }))
      ) {
        throw new Error(`The app is not installed for the organization or user "${teamOwner}"`);
      }
      await this.createOrgTeamDiscussion(userGithubService, appGitHubService, logger, options, parsedItems);
    }
  }

  private async createOrgTeamDiscussion(
    userGithubService: GitHubService,
    appGitHubService: GitHubService,
    logger: DeprecatedLogger,
    options: {
      filepath: string;
      pullInfo: PullInfo;
      userToken: string;
      dryRun: boolean;
      fileref?: string | undefined;
      pullRequestCommentId?: number | undefined;
    },
    parsedItems: ParsedMarkdownDiscussion
  ) {
    const newDiscussion = await userGithubService.createOrgTeamDiscussion({
      ...options,
      ...parsedItems,
      team: parsedItems.team!,
      owner: parsedItems.teamOwner!,
    });
    if (!options.dryRun) {
      if (newDiscussion) {
        await this.createPrSuccessComment(appGitHubService, logger, options, newDiscussion.title, newDiscussion.html_url, "team");
      } else {
        await this.createPrErrorComment(appGitHubService, options);
      }
    }
  }

  private async createPrErrorComment(appGitHubService: GitHubService, options: { pullInfo: PullInfo; pullRequestCommentId?: number | undefined }) {
    await appGitHubService.createPullRequestCommentReply({
      ...options.pullInfo,
      comment_id: options.pullRequestCommentId!,
      body: `⛔️ Something went wrong. Make sure that you have installed and authorized the app on any repository or team that you would like to post to. Then recreate this PR 👍🏼`,
    });
  }

  private async createRepoDiscussion(
    appGitHubService: GitHubService,
    userGithubService: GitHubService,
    logger: DeprecatedLogger,
    options: {
      pullInfo: PullInfo;
      parsedItems: ParsedMarkdownDiscussion;
      dryRun: boolean;
      pullRequestCommentId?: number;
    }
  ) {
    const repoData = await appGitHubService.getRepoData({
      repoName: options.parsedItems.repo!,
      owner: options.parsedItems.repoOwner!,
    });
    logger.trace(`repoData: ${JSON.stringify(repoData)}`);
    const discussionCategoryMatch = await this.getDiscussionCategory(appGitHubService, options.parsedItems);

    const newDiscussion = await userGithubService.createRepoDiscussion({
      ...options,
      ...options.parsedItems,
      repoNodeId: repoData.node_id,
      categoryNodeId: discussionCategoryMatch.id,
    });

    if (!options.dryRun) {
      if (newDiscussion) {
        await this.createPrSuccessComment(appGitHubService, logger, options, newDiscussion.title, newDiscussion.url, "repository");
      } else {
        await this.createPrErrorComment(appGitHubService, options);
      }
    }
  }

  private async createPrSuccessComment(
    appGitHubService: GitHubService,
    logger: DeprecatedLogger,
    options: {
      pullInfo: PullInfo;
      dryRun: boolean;
      pullRequestCommentId?: number | undefined;
    },
    discussionTitle: string,
    discussionUrl: string,
    discussionType: "team" | "repository"
  ) {
    logger.info("Creating success comment reply on original PR comment...");
    if (!options.pullRequestCommentId) {
      logger.info("Skipping creating PR success comment reply. No PR Comment ID was provided.");
      return;
    }
    await appGitHubService.createPullRequestCommentReply({
      ...options.pullInfo,
      comment_id: options.pullRequestCommentId!,
      body: `🎉 This ${discussionType} discussion has been posted! 🎉\n> View it here: [${discussionTitle}](${discussionUrl})`,
    });
    logger.info("Done.");
  }

  private async getDiscussionCategory(appGitHubService: GitHubService, parsedItems: ParsedMarkdownDiscussion) {
    const repoDiscussionCategories = await appGitHubService.getRepoDiscussionCategories({
      repo: parsedItems.repo!,
      owner: parsedItems.repoOwner!,
    });
    if (!repoDiscussionCategories || repoDiscussionCategories.length === 0) {
      throw new Error(`Discussions are not enabled on ${parsedItems.repoOwner}/${parsedItems.repo}`);
    }
    const discussionCategoryMatch = repoDiscussionCategories.find(
      (node) =>
        node?.name.trim().localeCompare(parsedItems.discussionCategoryName!, undefined, {
          sensitivity: "accent",
        }) === 0
    );
    if (!discussionCategoryMatch) {
      throw new Error(`Could not find discussion category "${parsedItems.discussionCategoryName} in ${parsedItems.repoOwner}/${parsedItems.repo}".`);
    }
    return discussionCategoryMatch;
  }

  private shouldCreateDiscussionForFile(appSettings: AppSettings, filepath: string) {
    const matchingWatchFolders = appSettings.watch_folders.filter((folder) => filepath.startsWith(folder));
    const matchingIgnoreFolders = appSettings.ignore_folders.filter((folder) => filepath.startsWith(folder));
    const isMarkdown = filepath.endsWith(".md");
    const willPostOnMerge = matchingWatchFolders.length > 0 && matchingIgnoreFolders.length === 0 && isMarkdown;
    return willPostOnMerge;
  }
}
