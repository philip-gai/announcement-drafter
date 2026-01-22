import { Octokit } from "@octokit/core";
import { CreateDiscussionPayload, Discussion, DiscussionCategory, Label, Maybe, Repository } from "@octokit/graphql-schema";
import { PaginateInterface } from "@octokit/plugin-paginate-rest";
import { RestEndpointMethods } from "@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types";
import { Api } from "@octokit/plugin-rest-endpoint-methods/dist-types/types";
import { API } from "@probot/octokit-plugin-config/dist-types/types";
import { ProbotOctokit } from "probot";
import type { Logger } from "probot";
import { AppConfig } from "../models/appConfig";
import { Content } from "../models/fileContent";
import { GitHubApp, PullRequestComment, TeamDiscussion } from "../models/githubModels";

export type OctokitPlus = Octokit & RestEndpointMethods & Api & PaginateInterface & API;

export class GitHubService {
  private _octokit: OctokitPlus;
  private _logger: Logger;
  private _appConfig: AppConfig;

  private constructor(octokit: OctokitPlus, logger: Logger, appConfig: AppConfig) {
    this._octokit = octokit;
    this._logger = logger;
    this._appConfig = appConfig;
  }

  public static buildForUser(token: string, logger: Logger, appConfig: AppConfig): GitHubService {
    const octokit = new ProbotOctokit({
      auth: { token: token },
      log: logger,
    }) as unknown as OctokitPlus;
    return new GitHubService(octokit, logger, appConfig);
  }

  public static buildForApp(octokit: OctokitPlus, logger: Logger, appConfig: AppConfig): GitHubService {
    return new GitHubService(octokit, logger, appConfig);
  }

  public async getUser(): Promise<unknown> {
    const user = await this._octokit.users.getAuthenticated();
    return user;
  }

  public async getFileContent(options: { owner: string; repo: string; path: string; ref?: string }): Promise<string> {
    this._logger.debug(`Getting file content... ${JSON.stringify(options)}`);

    const contentResponse = await this._octokit.repos.getContent(options);

    this._logger.trace(`File content response: ${JSON.stringify(contentResponse)}`);
    const content = contentResponse as unknown as Content;

    this._logger.debug(`Buffering and decoding base64 encoded data...`);
    const contentDataBuffer = Buffer.from(content.data.content, "base64");
    const contentData = contentDataBuffer.toString("utf-8");

    this._logger.info("Success getting file content.");
    this._logger.trace(`File content data: ${contentData}`);
    return contentData;
  }

  // See https://docs.github.com/rest/reference/repos#get-a-repository
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async getRepoData(options: { repoName: string; owner: string }): Promise<any> {
    this._logger.info(`Getting repo data...`);
    try {
      const repoResponse = await this._octokit.repos.get({
        ...options,
        repo: options.repoName,
      });
      this._logger.info(`Done getting repo data.`);
      if (!repoResponse?.data) throw new Error(`Could not find repo: ${JSON.stringify(options)}`);
      return repoResponse.data;
    } catch (_error: unknown) {
      throw new Error(`Could not find the repository. Make sure the URL is correct and the GitHub App is installed on "${options.owner}/${options.repoName}"`);
    }
  }

  public async getRepoDiscussionCategories(options: { repo: string; owner: string }): Promise<Maybe<Maybe<DiscussionCategory>[]> | undefined> {
    this._logger.info(`Getting discussion categories: ${JSON.stringify(options)}`);
    const discussionCategoriesResponse = await this._octokit.graphql<{
      repository: Repository;
    }>(
      `query ($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            discussionCategories(first: 100) {
              # type: DiscussionCategoryConnection
              nodes {
                # type: DiscussionCategory
                id
                name
              }
            }
          }
        }`,
      {
        owner: options.owner,
        repo: options.repo,
      },
    );
    this._logger.trace(`discussionCategories: ${JSON.stringify(discussionCategoriesResponse)}`);
    return discussionCategoriesResponse.repository.discussionCategories.nodes;
  }

  public async getPullRequestFiles(options: { owner: string; repo: string; pull_number: number }): Promise<
    {
      sha: string;
      filename: string;
      status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
      additions: number;
      deletions: number;
      changes: number;
      blob_url: string;
      raw_url: string;
      contents_url: string;
      patch?: string | undefined;
      previous_filename?: string | undefined;
    }[]
  > {
    this._logger.info(`Getting pull request files...\n${JSON.stringify(options)}`);
    const pullFiles = await this._octokit.pulls.listFiles(options);
    this._logger.info("Done getting pull request files.");
    return pullFiles.data;
  }

  public async createPullRequestComment(options: {
    owner: string;
    repo: string;
    pull_number: number;
    body: string;
    filepath: string;
    commit_id: string;
    start_line?: number;
    end_line: number;
  }): Promise<PullRequestComment | null> {
    const isDryRun = this._appConfig.dry_run_comments;
    this._logger.info(`${isDryRun ? "DRY RUN: " : ""}Commenting on the PR...`);
    this._logger.debug(`Options: ${JSON.stringify(options)}`);

    if (isDryRun) {
      this._logger.info("Dry run, not creating comments.");
      return null;
    }

    // There is a bug where you can't pass unwanted keys
    const response = await this._octokit.pulls.createReviewComment({
      owner: options.owner,
      repo: options.repo,
      pull_number: options.pull_number,
      body: options.body,
      path: options.filepath,
      commit_id: options.commit_id,
      start_line: options.start_line,
      line: options.end_line,
    });
    this._logger.info(`Done creating pull request review comment.`);
    return response.data;
  }

  public async updatePullRequestComment(options: { owner: string; repo: string; comment_id: number; body: string }): Promise<void> {
    const isDryRun = this._appConfig.dry_run_comments;
    this._logger.info(`${isDryRun ? "DRY RUN: " : ""}Updating comment on the PR...`);
    this._logger.debug(`Options: ${JSON.stringify(options)}`);

    if (isDryRun) {
      this._logger.info("Dry run, not updating comments.");
      return;
    }

    // There is a bug where you can't pass unwanted keys
    await this._octokit.pulls.updateReviewComment({
      owner: options.owner,
      repo: options.repo,
      comment_id: options.comment_id,
      body: options.body,
    });
    this._logger.info(`Done updating the pull request review comment.`);
  }

  public async createPullRequestCommentReply(options: { owner: string; repo: string; pull_number: number; comment_id: number; body: string }): Promise<void> {
    this._logger.info(`Creating a reply to a review comment...\n${JSON.stringify(options)}`);

    // There is a bug where you can't pass unwanted keys
    await this._octokit.pulls.createReplyForReviewComment({
      owner: options.owner,
      repo: options.repo,
      pull_number: options.pull_number,
      comment_id: options.comment_id,
      body: options.body,
    });

    this._logger.info("Done creating a reply to a review comment.");
  }

  public async getPullRequestComments(options: { owner: string; repo: string; pull_number: number }): Promise<PullRequestComment[]> {
    this._logger.info(`Getting pull request comments...\n${JSON.stringify(options)}`);
    const comments = await this._octokit.pulls.listReviewComments({
      ...options,
      per_page: 100, // 100 is the GitHub limit
      sort: "updated",
      direction: "desc",
    });
    this._logger.trace(`Comments:\n${JSON.stringify(comments.data)}`);
    this._logger.info("Done getting pull request comments.");
    return comments.data;
  }

  // https://docs.github.com/en/graphql/guides/using-the-graphql-api-for-discussions#creatediscussion
  public async createRepoDiscussion(options: {
    repoNodeId: string;
    categoryNodeId: string;
    postBody: string;
    postTitle: string;
    dryRun: boolean;
  }): Promise<Maybe<Discussion> | undefined> {
    const isDryRun = this._appConfig.dry_run_posts || options.dryRun;
    this._logger.info(`${isDryRun ? "DRY RUN: " : ""}Creating repo discussion...`);
    if (isDryRun) {
      this._logger.info("Dry run, not creating.");
      return;
    }
    const graphqlResponse = await this._octokit.graphql<{
      createDiscussion: CreateDiscussionPayload;
    }>(
      `mutation ($repoNodeId: ID!, $categoryNodeId: ID!, $postBody: String!, $postTitle: String!) {
        createDiscussion(input: {repositoryId: $repoNodeId, categoryId: $categoryNodeId, body: $postBody, title: $postTitle}) {
          discussion {
            id
            title
            url
          }
        }
      }`,
      {
        repoNodeId: options.repoNodeId,
        categoryNodeId: options.categoryNodeId,
        postBody: options.postBody,
        postTitle: options.postTitle,
      },
    );

    this._logger.info("Successfully created the repo discussion.");
    this._logger.trace(`graphqlResponse: ${JSON.stringify(graphqlResponse)}`);
    return graphqlResponse.createDiscussion.discussion;
  }

  public async createTeamPost(options: {
    owner: string;
    team: string;
    postTitle: string;
    postBody: string;
    dryRun: boolean;
  }): Promise<TeamDiscussion | undefined> {
    const isDryRun = this._appConfig.dry_run_posts || options.dryRun;
    this._logger.info(`${isDryRun ? "DRY RUN: " : ""}Creating team post...`);
    if (isDryRun) {
      this._logger.info("Dry run, not creating.");
      return;
    }
    const discussion = await this._octokit.teams.createDiscussionInOrg({
      org: options.owner,
      team_slug: options.team,
      title: options.postTitle,
      body: options.postBody,
    });
    this._logger.info("Successfully created the team post.");
    return discussion.data;
  }

  public async appIsInstalled(options: { owner: string }): Promise<boolean> {
    this._logger.debug(`Getting app installations...`);
    const appInstallations = await this._octokit.apps.listInstallations({
      per_page: 100,
    });
    this._logger.trace(`App Installations:\n${JSON.stringify(appInstallations.data)}`);
    const match = appInstallations.data.find((installation) => installation.account?.login === options.owner);
    const hasAccess = !!match;
    this._logger.debug(`HasAccess: ${hasAccess}`);
    return hasAccess;
  }

  public async getAuthenticatedApp(): Promise<GitHubApp> {
    this._logger.info(`Getting authenticated app...`);
    const authenticatedApp = await this._octokit.apps.getAuthenticated();
    this._logger.trace(`authenticatedApp:\n${JSON.stringify(authenticatedApp)}`);
    this._logger.info(`Done getting the authenticated app.`);
    if (!authenticatedApp.data) {
      throw new Error("Failed to get authenticated app");
    }
    return authenticatedApp.data as GitHubApp;
  }

  public async getRepoLabels(options: { repo: string; owner: string }): Promise<Maybe<Maybe<Label>[]> | undefined> {
    this._logger.info(`Getting repository labels: ${JSON.stringify(options)}`);
    const labelsResponse = await this._octokit.graphql<{
      repository: Repository;
    }>(
      `query ($owner: String!, $repo: String!) {
          repository(owner: $owner, name: $repo) {
            labels(first: 100) {
              nodes {
                id
                name
              }
            }
          }
        }`,
      {
        owner: options.owner,
        repo: options.repo,
      },
    );
    this._logger.trace(`labels: ${JSON.stringify(labelsResponse)}`);
    return labelsResponse.repository.labels?.nodes;
  }

  public async addLabelsToDiscussion(options: { discussionId: string; labelIds: string[]; dryRun: boolean }): Promise<void> {
    const isDryRun = this._appConfig.dry_run_posts || options.dryRun;
    this._logger.info(`${isDryRun ? "DRY RUN: " : ""}Adding labels to discussion...`);
    if (isDryRun) {
      this._logger.info("Dry run, not adding labels.");
      return;
    }
    if (options.labelIds.length === 0) {
      this._logger.info("No labels to add.");
      return;
    }
    await this._octokit.graphql(
      `mutation ($labelableId: ID!, $labelIds: [ID!]!) {
        addLabelsToLabelable(input: {labelableId: $labelableId, labelIds: $labelIds}) {
          labelable {
            ... on Discussion {
              id
              title
            }
          }
        }
      }`,
      {
        labelableId: options.discussionId,
        labelIds: options.labelIds,
      },
    );
    this._logger.info("Successfully added labels to the discussion.");
  }
}
