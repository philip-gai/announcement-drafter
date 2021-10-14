import { Octokit } from "@octokit/core";
import { PaginateInterface } from "@octokit/plugin-paginate-rest";
import { RestEndpointMethods } from "@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types";
import { Api } from "@octokit/plugin-rest-endpoint-methods/dist-types/types";
import { API } from "@probot/octokit-plugin-config/dist-types/types";
import { ProbotOctokit } from "probot";
import { DeprecatedLogger } from "probot/lib/types";
import { AppConfig } from "../models/appConfig";
import { Content } from "../models/fileContent";

export type OctokitPlus = Octokit &
  RestEndpointMethods &
  Api &
  PaginateInterface &
  API;

export class GitHubService {
  private _octokit: OctokitPlus;
  private _logger: DeprecatedLogger;
  private _appConfig: AppConfig;

  private constructor(
    octokit: OctokitPlus,
    logger: DeprecatedLogger,
    appConfig: AppConfig
  ) {
    this._octokit = octokit;
    this._logger = logger;
    this._appConfig = appConfig;
  }

  public static buildForUser(
    token: string,
    logger: DeprecatedLogger,
    appConfig: AppConfig
  ): GitHubService {
    const octokit = new ProbotOctokit({
      auth: { token: token },
      log: logger,
    }) as unknown as OctokitPlus;
    return new GitHubService(octokit, logger, appConfig);
  }

  public static buildForApp(
    octokit: OctokitPlus,
    logger: DeprecatedLogger,
    appConfig: AppConfig
  ) {
    return new GitHubService(octokit, logger, appConfig);
  }

  public async getUser(): Promise<unknown> {
    const user = await this._octokit.users.getAuthenticated();
    return user;
  }

  public async getFileContent(options: {
    owner: string;
    repo: string;
    path: string;
    ref?: string;
  }): Promise<string> {
    this._logger.debug(`Getting file content... ${JSON.stringify(options)}`);

    const contentResponse = await this._octokit.repos.getContent(options);

    this._logger.trace(`content: ${JSON.stringify(contentResponse)}`);
    const content = contentResponse as unknown as Content;

    this._logger.debug(`Buffering and decoding base64 encoded data...`);
    const contentDataBuffer = Buffer.from(content.data.content, "base64");
    const contentData = contentDataBuffer.toString("utf-8");

    this._logger.info("Success.");
    this._logger.trace(`Data: ${contentData}`);
    return contentData;
  }

  public async createOrgTeamDiscussion(options: {
    owner: string;
    team: string;
    postTitle: string;
    postBody: string;
    dryRun: boolean;
  }) {
    this._logger.info("Creating org team discussion...");
    if (this._appConfig.dry_run_posts || options.dryRun) {
      this._logger.info("Dry run, not creating.");
      return;
    }
    await this._octokit.teams.createDiscussionInOrg({
      org: options.owner,
      team_slug: options.team,
      title: options.postTitle,
      body: options.postBody,
    });
    this._logger.info("Successfully created the org team discussion.");
  }

  public async getRepoData(options: { repoName: string; owner: string }) {
    const repoResponse = await this._octokit.repos.get({
      ...options,
      repo: options.repoName,
    });
    if (!repoResponse?.data)
      throw new Error(`Could not find repo: ${JSON.stringify(options)}`);
    return repoResponse.data;
  }

  public async getRepoDiscussionCategories(options: {
    repo: string;
    owner: string;
  }) {
    this._logger.info(
      `Getting discussion categories: ${JSON.stringify(options)}`
    );
    const discussionCategoriesResponse: {
      repository: {
        discussionCategories: { nodes: { id: string; name: string }[] };
      };
    } = await this._octokit.graphql(
      `query ($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            discussionCategories(first: 10) {
              # type: DiscussionCategoryConnection
              nodes {
                # type: DiscussionCategory
                id
                name
              }
            }
          }
        }`,
      options
    );
    this._logger.trace(
      `discussionCategories: ${JSON.stringify(discussionCategoriesResponse)}`
    );
    return discussionCategoriesResponse.repository.discussionCategories.nodes;
  }

  public async getPullRequestFiles(options: {
    owner: string;
    repo: string;
    pull_number: number;
  }) {
    this._logger.info(
      `Getting pull request files...\n${JSON.stringify(options)}`
    );
    const pullFiles = await this._octokit.pulls.listFiles(options);
    this._logger.info("Done.");
    return pullFiles.data;
  }

  public async commentOnPullRequest(options: {
    owner: string;
    repo: string;
    pull_number: number;
    body: string;
    filepath: string;
    commit_id: string;
    start_line?: number;
    end_line: number;
  }) {
    this._logger.info(`Commenting on the PR...\n${JSON.stringify(options)}`);
    if (this._appConfig.dry_run_comments) {
      this._logger.info("Dry run, not creating comments.");
      return;
    }
    await this._octokit.pulls.createReviewComment({
      owner: options.owner,
      repo: options.repo,
      pull_number: options.pull_number,
      body: options.body,
      path: options.filepath,
      commit_id: options.commit_id,
      start_line: options.start_line,
      line: options.end_line,
    });
    this._logger.info(`Done.`);
  }

  public async addPullRequestReviewers(options: {
    owner: string;
    repo: string;
    pull_number: number;
    reviewers: string[];
  }) {
    this._logger.info(`Adding PR reviewers:\n${JSON.stringify(options)}`);
    if (this._appConfig.dry_run_comments) {
      this._logger.info("Dry run, not adding reviewers.");
      return;
    }
    await this._octokit.pulls.requestReviewers(options);
  }

  public async getPullRequestComments(options: {
    owner: string;
    repo: string;
    pull_number: number;
  }) {
    this._logger.info(
      `Getting pull request comments...\n${JSON.stringify(options)}`
    );
    const comments = await this._octokit.pulls.listReviewComments({
      ...options,
      per_page: 100, // 100 is the GitHub limit
    });
    this._logger.info("Done.");
    this._logger.trace(JSON.stringify(comments.data));
    return comments.data;
  }

  public async getPullRequestCommentReaction(options: {
    owner: string;
    repo: string;
    comment_id: number;
  }) {
    this._logger.info(
      `Getting pull request comment reactions...\n${JSON.stringify(options)}`
    );
    const commentReactions =
      await this._octokit.reactions.listForPullRequestReviewComment({
        ...options,
        per_page: 100,
      });
    this._logger.info("Done.");
    return commentReactions.data;
  }

  // https://docs.github.com/en/graphql/guides/using-the-graphql-api-for-discussions#creatediscussion
  public async createRepoDiscussion(options: {
    repoNodeId: string;
    categoryNodeId: string;
    postBody: string;
    postTitle: string;
    dryRun: boolean;
  }) {
    this._logger.info("Creating repo discussion...");
    if (this._appConfig.dry_run_posts || options.dryRun) {
      this._logger.info("Dry run, not creating.");
      return;
    }
    await this._octokit.graphql(
      `mutation ($repoNodeId: ID!, $categoryNodeId: ID!, $postBody: String!, $postTitle: String!) {
        createDiscussion(input: {repositoryId: $repoNodeId, categoryId: $categoryNodeId, body: $postBody, title: $postTitle}) {
          discussion {
            id
          }
        }
      }`,
      options
    );
    this._logger.info("Successfully created the repo discussion.");
  }
}
