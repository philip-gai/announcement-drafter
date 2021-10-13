import { EventPayloads } from "@octokit/webhooks";
import { Context } from "probot";
import { DeprecatedLogger } from "probot/lib/types";
import { AppConfig } from "../models/appConfig";
import { AppSettings } from "../models/appSettings";
import { ConfigService } from "../services/configService";
import { GitHubService, OctokitPlus } from "../services/githubService";
import {
  ParsedMarkdownDiscussion,
  ParserService,
} from "../services/parserService";
import { TokenService } from "../services/tokenService";

interface PullInfo {
  owner: string;
  repo: string;
  repoName: string;
  pull_number: number;
}

export class PullRequestEventHandler {
  private _tokenService: TokenService;
  private _configService: ConfigService;

  private constructor(
    tokenService: TokenService,
    configService: ConfigService
  ) {
    this._tokenService = tokenService;
    this._configService = configService;
  }

  public static async build(
    context: Context<EventPayloads.WebhookPayloadPullRequest>,
    tokenService: TokenService
  ) {
    const configService = await ConfigService.build(context.log, context);
    const appSettings = configService.appConfig.appSettings;
    if (!appSettings)
      throw new Error(
        "Make sure to build the config service with the webhook context"
      );
    return new PullRequestEventHandler(tokenService, configService);
  }

  public onOpened = async (
    context: Context<EventPayloads.WebhookPayloadPullRequest>
  ): Promise<void> => {
    const logger = context.log;
    logger.info("Handling pull_request.opened event...");

    const appConfig = this._configService.appConfig;
    const appGitHubService = GitHubService.buildForApp(
      context.octokit as unknown as OctokitPlus,
      logger,
      appConfig
    );
    const payload = context.payload;
    const pullInfo: PullInfo = {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      repoName: payload.repository.name,
      pull_number: payload.pull_request.number,
    };

    const isDefaultBranch =
      payload.pull_request.base.ref === payload.repository.default_branch;

    if (!isDefaultBranch) {
      logger.info(
        "The PR is not targeting the default branch, will not post anything"
      );
      return;
    }

    const pullRequestFiles = await appGitHubService.getPullRequestFiles(
      pullInfo
    );

    const filesAdded = pullRequestFiles.filter(
      (file) => file.status === "added"
    );

    logger.debug(`Number of files added in push: ${filesAdded.length}`);
    logger.debug(`Files: ${filesAdded.join(", ")}`);

    // Example filepath: "docs/team-posts/hello-world.md"
    filesAdded.forEach(async (file) => {
      const filepath = file.filename;
      const shouldCreateDiscussionForFile = this.shouldCreateDiscussionForFile(
        appConfig.appSettings,
        filepath
      );
      if (shouldCreateDiscussionForFile) {
        // Parse the markdown to get the discussion metadata and details
        const parsedMarkdown = await this.getParsedMarkdownDiscussion(
          appGitHubService,
          filepath,
          pullInfo,
          logger,
          payload.pull_request.head.ref
        );

        if (parsedMarkdown.author !== payload.pull_request.user.login)
          await appGitHubService.addPullRequestReviewers({
            ...pullInfo,
            reviewers: [parsedMarkdown.author],
          });
        await appGitHubService.commentOnPullRequest({
          ...pullInfo,
          commit_id: payload.pull_request.head.sha,
          start_line: 1,
          end_line: 6,
          body: `⚠️⚠️ A discussion will be created using this file once this PR is merged ⚠️⚠️\n\nTo approve, @${parsedMarkdown.author} **must** react to this comment with a 🚀`,
          filepath: filepath,
        });
      }
    });
  };

  public onMerged = async (
    context: Context<EventPayloads.WebhookPayloadPullRequest>
  ): Promise<void> => {
    const logger = context.log;
    logger.info("Handling pull_request.opened event...");

    const appConfig = this._configService.appConfig;
    const appGitHubService = GitHubService.buildForApp(
      context.octokit as unknown as OctokitPlus,
      logger,
      appConfig
    );

    const payload = context.payload;
    const pullInfo: PullInfo = {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      repoName: payload.repository.name,
      pull_number: payload.pull_request.number,
    };

    const isDefaultBranch =
      payload.pull_request.base.ref === payload.repository.default_branch;

    if (!isDefaultBranch) {
      logger.info(
        "The PR is not targeting the default branch, will not post anything"
      );
      return;
    }

    // 1. (Shortcut) Look for comments made by (repo)st and which files they were made on
    logger.info(`Getting authenticated app name...`);
    const authenticatedApp = await context.octokit.apps.getAuthenticated();
    const appLogin = `${authenticatedApp.data.name}[bot]`;
    logger.info(`App Login: ${appLogin}`);

    const pullRequestComments = await appGitHubService.getPullRequestComments({
      ...pullInfo,
    });

    // Our app will skip it if our comment has been edited (for security)
    const repostComments = pullRequestComments.filter(
      (comment) =>
        comment.user.login === appLogin &&
        !comment.in_reply_to_id &&
        comment.path
    );

    if (repostComments.length == 0) {
      logger.info("No repost-app[bot] comments found on this PR");
      return;
    }

    // 2. Check for the reaction of "🚀" made by the author
    repostComments.forEach(async (fileToPostComment) => {
      const authorLogin = fileToPostComment.body.split("@")[1].split(" ")[0];
      const reactions = await appGitHubService.getPullRequestCommentReaction({
        ...pullInfo,
        comment_id: fileToPostComment.id,
      });
      const authorApprovalReaction = reactions.find(
        (reaction) =>
          reaction.content === "rocket" && reaction.user?.login === authorLogin
      );
      if (authorApprovalReaction) {
        logger.info("Found an approval!");
        logger.info("Found an approval!");
        // 3. Create the discussions based off of the file
        const filepath = fileToPostComment.path;
        await this.createDiscussion(
          appGitHubService,
          filepath,
          pullInfo,
          logger,
          appConfig
        );
      }
    });
  };

  private async getParsedMarkdownDiscussion(
    appGitHubService: GitHubService,
    filepath: string,
    pullInfo: PullInfo,
    logger: DeprecatedLogger,
    fileref?: string
  ): Promise<ParsedMarkdownDiscussion> {
    const fileContent = await appGitHubService.getFileContent({
      path: filepath,
      ref: fileref,
      ...pullInfo,
    });
    logger.info("Parsing the markdown information...");
    const parserService = ParserService.build(fileContent, logger);
    const parsedItems = parserService.parseDocument();
    return parsedItems;
  }

  private async createDiscussion(
    appGitHubService: GitHubService,
    filepath: string,
    pullInfo: PullInfo,
    logger: DeprecatedLogger,
    appConfig: AppConfig
  ) {
    logger.debug("Begin createDiscussion method...");
    const parsedItems = await this.getParsedMarkdownDiscussion(
      appGitHubService,
      filepath,
      pullInfo,
      logger
    );
    logger.debug(`Parsed Document Items: ${JSON.stringify(parsedItems)}`);

    const token = await this._tokenService.refreshUserToken(parsedItems.author);

    const userGithubService = GitHubService.buildForUser(
      token,
      logger,
      appConfig
    );

    if (!parsedItems.repo && !parsedItems.team)
      throw new Error(
        "Markdown is missing a repo or team to post the discussion to"
      );

    // Check for repo to post to
    if (parsedItems.repo) {
      if (!parsedItems.repoOwner)
        throw new Error(
          "Missing target repo owner - repo url should include the owner (org)"
        );
      await this.createRepoDiscussion(
        appGitHubService,
        pullInfo,
        logger,
        parsedItems,
        userGithubService
      );
    }

    // Check for team to post to
    if (parsedItems.team) {
      if (!parsedItems.teamOwner)
        throw new Error(
          "The url to the team is not valid - it must include the team owner (org)"
        );
      await userGithubService.createOrgTeamDiscussion({
        ...parsedItems,
        team: parsedItems.team,
        owner: parsedItems.teamOwner,
      });
    }
  }

  private async createRepoDiscussion(
    appGitHubService: GitHubService,
    pullInfo: PullInfo,
    logger: DeprecatedLogger,
    parsedItems: ParsedMarkdownDiscussion,
    userGithubService: GitHubService
  ) {
    const repoData = await appGitHubService.getRepoData(pullInfo);
    logger.trace(`repoData: ${JSON.stringify(repoData)}`);
    const repoDiscussionCategories =
      await appGitHubService.getRepoDiscussionCategories({
        repo: parsedItems.repo || "", // '' is not possible
        owner: parsedItems.repoOwner || "", // '' is not possible
      });
    const discussionCategoryMatch = repoDiscussionCategories.find((node) =>
      node.name
        .trim()
        .localeCompare(parsedItems.discussionCategoryName, undefined, {
          sensitivity: "accent",
        })
    );
    if (!discussionCategoryMatch)
      throw new Error("Could not find discussion category node");

    await userGithubService.createRepoDiscussion({
      repoNodeId: repoData.node_id,
      categoryNodeId: discussionCategoryMatch.id,
      ...parsedItems,
    });
  }

  private shouldCreateDiscussionForFile(
    appSettings: AppSettings,
    filepath: string
  ) {
    const matchingWatchFolders = appSettings.watch_folders.filter((folder) =>
      filepath.startsWith(folder)
    );
    const matchingIgnoreFolders = appSettings.ignore_folders.filter((folder) =>
      filepath.startsWith(folder)
    );
    const willPostOnMerge =
      matchingWatchFolders.length > 0 && matchingIgnoreFolders.length === 0;
    return willPostOnMerge;
  }
}
