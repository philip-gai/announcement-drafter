import { DiscussionCategory } from "@octokit/graphql-schema";
import { Context } from "probot";
import { DeprecatedLogger } from "probot/lib/types";
import { AppConfig } from "../models/appConfig";
import { AppSettings } from "../models/appSettings";
import { PullRequestComment } from "../models/githubModels";
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

  private _tokenService: TokenService;
  private _configService: ConfigService;

  private constructor(tokenService: TokenService, configService: ConfigService) {
    this._tokenService = tokenService;
    this._configService = configService;
  }

  public static async build(context: Context<"pull_request">, tokenService: TokenService): Promise<PullRequestEventHandler> {
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

  public onUpdated = async (context: Context<"pull_request">): Promise<void> => {
    const logger = context.log;

    logger.info(`Handling ${context.name} event...`);

    const appConfig = this._configService.appConfig;
    const appGitHubService = GitHubService.buildForApp(context.octokit as unknown as OctokitPlus, logger, appConfig);

    const payload = context.payload;

    const pullRepo = payload.repository;
    const pullRequest = payload.pull_request;
    const pullInfo: PullInfo = {
      owner: pullRepo.owner.login,
      repo: pullRepo.name,
      repoName: pullRepo.name,
      pull_number: pullRequest.number,
    };

    const isDefaultBranch = pullRequest.base.ref === pullRepo.default_branch;
    if (!isDefaultBranch) {
      logger.info("The PR is not targeting the default branch, will not post anything");
      return;
    }

    if (pullRequest.draft) {
      logger.info("This is a draft PR. Exiting.");
      return;
    }

    const pullRequestFiles = await appGitHubService.getPullRequestFiles(pullInfo);

    const filesAdded = pullRequestFiles.filter((file) => file.status === "added");

    if (filesAdded.length === 0) {
      logger.warn("No new files were added so nothing to process");
      logger.info("Exiting pull_request.onUpdated handler");
      return;
    }

    logger.debug(`Number of files added in push: ${filesAdded.length}`);

    const app = await appGitHubService.getAuthenticatedApp();
    const { appName, appPublicPage, appLogin } = {
      appName: app.name,
      appPublicPage: app.html_url,
      appLogin: `${app.slug}[bot]`,
    };
    const appLinkMarkdown = `[@${appName}](${appPublicPage})`;

    const pullRequestComments = await appGitHubService.getPullRequestComments({
      ...pullInfo,
    });
    const existingBotComments = pullRequestComments.filter((comment) => comment.user.login === appLogin && !comment.in_reply_to_id && comment.path);

    // Example filepath: "docs/team-posts/hello-world.md"
    for (const file of filesAdded) {
      const filepath = file.filename;
      let mostRecentBotCommentForFile = this.getMostRecentBotCommentForFile(existingBotComments, filepath, logger);
      const shouldCreateDiscussionForFile = this.shouldCreateDiscussionForFile(appConfig.appSettings, filepath);
      if (shouldCreateDiscussionForFile) {
        try {
          const fileref = pullRequest.head.ref;
          // Parse the markdown to get the discussion metadata and details
          const parsedMarkdown = await this.getParsedMarkdownDiscussion(appGitHubService, logger, {
            filepath: filepath,
            pullInfo: pullInfo,
            fileref: fileref,
          });

          const authorLogin = pullRequest.user.login;

          if (!parsedMarkdown.repo && !parsedMarkdown.team) {
            throw new Error("Markdown is missing a repo or team to post the discussion to");
          }

          let commentBody = `⚠️ ${appLinkMarkdown} will create a discussion using this file once this PR is merged ⚠️\n\n` + "**IMPORTANT**:\n\n";

          const userRefreshToken = await this._tokenService.getRefreshToken({
            userLogin: authorLogin,
          });

          // Only look for existing refresh tokens in production, otherwise always refresh and then clear
          // This avoids the shared cosmos instance storing invalid refresh tokens
          const isNonProd = this._configService.appConfig.appId !== ConfigService.prodAppId;
          if (isNonProd && userRefreshToken) {
            await this._tokenService.deleteRefreshToken(authorLogin);
          }
          if (!userRefreshToken || isNonProd) {
            const fullAuthUrl = `${appConfig.base_url}${appConfig.auth_url}?pull_url=${pullRequest.html_url}`;
            commentBody += `- @${authorLogin}: you must [authorize the app](${fullAuthUrl}) before merging this pull request so the discussion can be created as you. This is not required every time.\n`;
          }
          commentBody +=
            "- Do not use relative links to files in your repo. Instead, use full URLs and for media drag/drop or paste the file into the markdown. The link generated for media should contain `https://user-images.githubusercontent.com`.\n";

          if (!mostRecentBotCommentForFile) {
            mostRecentBotCommentForFile = await appGitHubService.createPullRequestComment({
              ...pullInfo,
              commit_id: pullRequest.head.sha,
              start_line: 1,
              end_line: parsedMarkdown.headerEndLine,
              body: commentBody,
              filepath: filepath,
            });
          } else if (mostRecentBotCommentForFile.body !== commentBody) {
            // If we've already commented on this file, and our new comment has new info, update the comment
            await appGitHubService.updatePullRequestComment({
              ...pullInfo,
              comment_id: mostRecentBotCommentForFile.id,
              body: commentBody,
            });
          } else {
            logger.info("Not updating the comment because nothing has changed.");
          }

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
          const errorMessage =
            `${this.errorIcon} ${appLinkMarkdown} will not be able to create a discussion for \`${filepath}\` ${this.errorIcon}\n\n` +
            `Please fix the issues and update the PR:\n\n` +
            `> ${exceptionMessage}\n`;
          if (mostRecentBotCommentForFile) {
            await appGitHubService.updatePullRequestComment({
              ...pullInfo,
              comment_id: mostRecentBotCommentForFile.id,
              body: errorMessage,
            });
          } else {
            await appGitHubService.createPullRequestComment({
              ...pullInfo,
              commit_id: pullRequest.head.sha,
              end_line: 1,
              body: errorMessage,
              filepath: filepath,
            });
          }
        }
      }
    }
    logger.info("Exiting pull_request.onUpdated handler");
  };

  public onMerged = async (context: Context<"pull_request">): Promise<void> => {
    const logger = context.log;
    logger.info("Handling pull_request.closed and merged event...");

    const appConfig = this._configService.appConfig;
    const appGitHubService = GitHubService.buildForApp(context.octokit as unknown as OctokitPlus, logger, appConfig);

    const payload = context.payload;
    const pullRepo = payload.repository;
    const pullRequest = payload.pull_request;
    const pullInfo: PullInfo = {
      owner: pullRepo.owner.login,
      repo: pullRepo.name,
      repoName: pullRepo.name,
      pull_number: pullRequest.number,
    };

    const isDefaultBranch = pullRequest.base.ref === pullRepo.default_branch;

    if (!isDefaultBranch) {
      logger.info("The PR is not targeting the default branch, will not post anything");
      return;
    }

    // Get pull request comments
    const app = await appGitHubService.getAuthenticatedApp();
    const appLogin = `${app.slug}[bot]`;
    const optionalPullRequestFooterMarkdown = pullRepo.private ? "" : `<a href='${pullRequest.html_url}'>from a pull request</a> `;
    const postFooter = `\n\n<hr /><em>This discussion was created ${optionalPullRequestFooterMarkdown}using <a href='${app.html_url}'>${app.name}</a>.</em>\n`;

    const pullRequestComments = await appGitHubService.getPullRequestComments({
      ...pullInfo,
    });

    // Get comments made by the bot
    const botComments = pullRequestComments.filter(
      (comment) => comment.user.login === appLogin && !comment.in_reply_to_id && comment.path && !comment.body.includes(this.errorIcon)
    );

    if (botComments.length == 0) {
      logger.info(`No ${appLogin} comments found on this PR`);
      return;
    }

    // Assume the pull request author is the intended post author
    const authorLogin = pullRequest.user.login;
    const authorToken = await this._tokenService.refreshUserToken(authorLogin);

    // For each file to post
    for (const fileToPostComment of botComments) {
      // Create the discussion!
      const filepath = fileToPostComment.path;
      try {
        await this.createDiscussion(appGitHubService, logger, appConfig, {
          filepath: filepath,
          pullInfo: pullInfo,
          userToken: authorToken,
          dryRun: false,
          pullRequestCommentId: fileToPostComment.id,
          postFooter: postFooter,
        });
      } catch (err) {
        const errorMessage = HelperService.getErrorMessage(err);
        logger.error(errorMessage);
      }
    }
    // Delete the token to avoid conflicts with prod
    const appId = this._configService.appConfig.appId;
    if (appId !== ConfigService.prodAppId) {
      logger.info(`Current app (${appId}) is not prod, deleting ${authorLogin}'s refresh token`);
      await this._tokenService.deleteRefreshToken(authorLogin);
    }
    logger.info("Exiting pull_request.closed handler");
  };

  private getMostRecentBotCommentForFile(existingBotComments: PullRequestComment[], filepath: string, logger: DeprecatedLogger): PullRequestComment | null {
    const existingCommentForFile = existingBotComments.filter((comment) => comment.path === filepath);
    if (existingCommentForFile.length === 0) {
      return null;
    } else if (existingCommentForFile.length > 1) {
      logger.warn(`Found multiple comments for ${filepath}. Taking most recent.`);
    }
    const mostRecentBotComment = existingCommentForFile[0];
    logger.debug(`Found most recent bot comment for ${filepath}: Updated at ${mostRecentBotComment.updated_at}`);
    return mostRecentBotComment;
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
  ): Promise<void> {
    logger.debug("Begin createDiscussion method...");
    const parsedItems = await this.getParsedMarkdownDiscussion(appGitHubService, logger, options);

    // Appending footer here because it's not really parsed from the markdown
    if (options.postFooter) {
      parsedItems.postBody += options.postFooter;
    }

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
      await this.createTeamPost(userGithubService, appGitHubService, logger, options, parsedItems);
    }
  }

  private async createTeamPost(
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
  ): Promise<void> {
    if (!parsedItems.team || !parsedItems.teamOwner) throw new Error("Missing team or team owner");
    const newDiscussion = await userGithubService.createTeamPost({
      ...options,
      ...parsedItems,
      team: parsedItems.team,
      owner: parsedItems.teamOwner,
    });
    if (!options.dryRun) {
      if (newDiscussion) {
        await this.createPrSuccessComment(appGitHubService, logger, options, newDiscussion.title, newDiscussion.html_url, "team");
      } else {
        await this.createPrErrorComment(appGitHubService, options);
      }
    }
  }

  private async createPrErrorComment(
    appGitHubService: GitHubService,
    options: { pullInfo: PullInfo; pullRequestCommentId?: number | undefined }
  ): Promise<void> {
    if (!options.pullRequestCommentId) throw new Error("Missing pullRequestCommentId");
    await appGitHubService.createPullRequestCommentReply({
      ...options.pullInfo,
      comment_id: options.pullRequestCommentId,
      body: "⛔️ Something went wrong. Make sure that you have installed and authorized the app on any repository or team that you would like to post to. Then recreate this PR 👍🏼",
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
  ): Promise<void> {
    if (!options.parsedItems.repo || !options.parsedItems.repoOwner) throw new Error("Missing repo or repo owner");
    const repoData = await appGitHubService.getRepoData({
      repoName: options.parsedItems.repo,
      owner: options.parsedItems.repoOwner,
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
  ): Promise<void> {
    logger.info("Creating success comment reply on original PR comment...");
    if (!options.pullRequestCommentId) {
      logger.info("Not creating PR success comment reply. No PR Comment ID was provided.");
      return;
    }
    await appGitHubService.createPullRequestCommentReply({
      ...options.pullInfo,
      comment_id: options.pullRequestCommentId,
      body: `🎉 This ${discussionType} discussion has been posted! 🎉\n> View it here: [${discussionTitle}](${discussionUrl})`,
    });
    logger.info("Done creating success comment reply on original PR comment.");
  }

  private async getDiscussionCategory(appGitHubService: GitHubService, parsedItems: ParsedMarkdownDiscussion): Promise<DiscussionCategory> {
    const { repo, repoOwner, discussionCategoryName } = parsedItems;
    if (!repo || !repoOwner) throw new Error("Missing repo or repo owner");
    if (!discussionCategoryName) throw new Error("Missing discussion category name");

    const repoDiscussionCategories = await appGitHubService.getRepoDiscussionCategories({
      repo: repo,
      owner: repoOwner,
    });
    if (!repoDiscussionCategories || repoDiscussionCategories.length === 0) {
      throw new Error(`Discussions are not enabled on ${repoOwner}/${repo}`);
    }
    const discussionCategoryMatch = repoDiscussionCategories.find(
      (node) =>
        node?.name.trim().localeCompare(discussionCategoryName, undefined, {
          sensitivity: "accent", // this is case-insensitive
        }) === 0
    );
    if (!discussionCategoryMatch) {
      throw new Error(`Could not find discussion category "${discussionCategoryName} in ${repoOwner}/${repo}".`);
    }
    return discussionCategoryMatch;
  }

  private shouldCreateDiscussionForFile(appSettings: AppSettings, filepath: string): boolean {
    const matchingWatchFolders = appSettings.watch_folders.filter((folder) => filepath.startsWith(folder));
    const matchingIgnoreFolders = appSettings.ignore_folders.filter((folder) => filepath.startsWith(folder));
    const isMarkdown = filepath.endsWith(".md");
    const willPostOnMerge = matchingWatchFolders.length > 0 && matchingIgnoreFolders.length === 0 && isMarkdown;
    return willPostOnMerge;
  }
}
