import { Octokit } from "@octokit/core";
import { PaginateInterface } from "@octokit/plugin-paginate-rest";
import { RestEndpointMethods } from "@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types";
import { Api } from "@octokit/plugin-rest-endpoint-methods/dist-types/types";
import { API } from "@probot/octokit-plugin-config/dist-types/types";
import { ProbotOctokit } from "probot";
import { DeprecatedLogger } from "probot/lib/types";
import { Content } from "../models/fileContent";

export type OctokitPlus = Octokit &
  RestEndpointMethods &
  Api &
  PaginateInterface &
  API;

export class GitHubService {
  private _octokit: OctokitPlus;
  private _logger: DeprecatedLogger;

  private constructor(octokit: OctokitPlus, logger: DeprecatedLogger) {
    this._octokit = octokit;
    this._logger = logger;
  }

  public static buildForUser(
    token: string,
    logger: DeprecatedLogger
  ): GitHubService {
    const octokit = new ProbotOctokit({
      auth: { token: token },
      log: logger,
    }) as unknown as OctokitPlus;
    return new GitHubService(octokit, logger);
  }

  public static buildForApp(octokit: OctokitPlus, logger: DeprecatedLogger) {
    return new GitHubService(octokit, logger);
  }

  public async getUser(): Promise<unknown> {
    const user = await this._octokit.users.getAuthenticated();
    return user;
  }

  public async getFileContent(
    owner: string,
    repo: string,
    path: string
  ): Promise<string> {
    this._logger.debug(
      `Getting file content... owner=${owner}, repo=${repo}, path=${path}`
    );
    const contentResponse = await this._octokit.repos.getContent({
      owner: owner,
      repo: repo,
      path: path,
    });
    this._logger.trace(`content: ${JSON.stringify(contentResponse)}`);
    const content = contentResponse as unknown as Content;
    this._logger.debug(`Buffering and decoding base64 encoded data...`);
    const contentDataBuffer = Buffer.from(content.data.content, "base64");
    const contentData = contentDataBuffer.toString("utf-8");
    this._logger.info("Success.");
    this._logger.trace(`Data: ${contentData}`);
    return contentData;
  }

  public async createOrgTeamDiscussion(
    owner: string,
    teamName: string,
    postTitle: string,
    postBody: string
  ) {
    this._logger.info("Creating org team discussion...");
    await this._octokit.teams.createDiscussionInOrg({
      org: owner,
      team_slug: teamName,
      title: postTitle,
      body: postBody,
    });
    this._logger.info("Successfully created the org team discussion.");
  }

  public async getRepoData(repoName: string, owner: string) {
    const repoResponse = await this._octokit.repos.get({
      owner: owner,
      repo: repoName,
    });
    if (!repoResponse?.data)
      throw new Error(
        `Could not find repo named ${repoName} owned by ${owner}`
      );
    return repoResponse.data;
  }

  public async getRepoDiscussionCategories(repoName: string, owner: string) {
    this._logger.info(`Getting discussion categories for ${owner}/${repoName}`);
    const discussionCategoriesResponse: {
      repository: {
        discussionCategories: { nodes: { id: string; name: string }[] };
      };
    } = await this._octokit.graphql(
      `query ($owner: String!, $name: String!) {
          repository(owner: $owner, name: $name) {
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
      {
        owner: owner,
        name: repoName,
      }
    );
    this._logger.trace(
      `discussionCategories: ${JSON.stringify(discussionCategoriesResponse)}`
    );
    return discussionCategoriesResponse.repository.discussionCategories.nodes;
  }

  // https://docs.github.com/en/graphql/guides/using-the-graphql-api-for-discussions#creatediscussion
  public async createRepoDiscussion(
    repoNodeId: string,
    categoryNodeId: string,
    body: string,
    title: string
  ) {
    this._logger.info("Creating repo discussion...");
    await this._octokit.graphql(
      `mutation ($repositoryId: ID!, $categoryId: ID!, $body: String!, $title: String!) {
        createDiscussion(input: {repositoryId: $repositoryId, categoryId: $categoryId, body: $body, title: $title}) {
          discussion {
            id
          }
        }
      }`,
      {
        repositoryId: repoNodeId,
        categoryId: categoryNodeId,
        body: body,
        title: title,
      }
    );
    this._logger.info("Successfully created the repo discussion.");
  }
}
