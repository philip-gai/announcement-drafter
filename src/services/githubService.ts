import { Octokit } from "@octokit/core";
import { PaginateInterface } from "@octokit/plugin-paginate-rest";
import { RestEndpointMethods } from "@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types";
import { Api } from "@octokit/plugin-rest-endpoint-methods/dist-types/types";
import { API } from "@probot/octokit-plugin-config/dist-types/types";
import { graphql as graphqlClient } from "@octokit/graphql/dist-types/types";
import { graphql } from "@octokit/graphql";
import { ProbotOctokit } from "probot";
import { DeprecatedLogger } from "probot/lib/types";

export type OctokitPlus = Octokit &
  RestEndpointMethods &
  Api &
  PaginateInterface &
  API;

export class GitHubService {
  private _octokit: OctokitPlus;
  private _graphqlClient?: graphqlClient;
  private _logger: DeprecatedLogger;

  private constructor(
    octokit: OctokitPlus,
    logger: DeprecatedLogger,
    graphqlClient?: graphqlClient
  ) {
    this._octokit = octokit;
    this._graphqlClient = graphqlClient;
    this._logger = logger;
  }

  public static buildForUser(
    token: string,
    logger: DeprecatedLogger
  ): GitHubService {
    const octokit = new ProbotOctokit({
      auth: { token: token },
      log: logger.child({ name: "my-octokit" }),
    }) as unknown as OctokitPlus;
    const graphqlClient = graphql.defaults({
      headers: {
        authorization: `token ${token}`,
      },
    });
    return new GitHubService(octokit, logger, graphqlClient);
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
  ): Promise<unknown> {
    const content = await this._octokit.repos.getContent({
      owner: owner,
      repo: repo,
      path: path,
    });
    this._logger.info(JSON.stringify(content));
    return content;
  }

  public async createOrgTeamDiscussion(org: string) {
    this._octokit.teams.createDiscussionInOrg({
      org: org,
      team_slug: "",
      title: "",
      body: "",
    });
  }

  // https://docs.github.com/en/graphql/guides/using-the-graphql-api-for-discussions#creatediscussion
  public async createRepoDiscussion(
    repoId: string,
    categoryId: string,
    body: string,
    title: string
  ) {
    if (!this._graphqlClient)
      throw new Error(
        "Programmer error: make sure to use the GitHubService built for the user"
      );
    await this._graphqlClient(
      `
    mutation {
        # input type: CreateDiscussionInput
        createDiscussion(input: {$repositoryId: ID!, categoryId: ID!, body: String!, title: String!}) {
      
          # response type: CreateDiscussionPayload
          discussion {
            id
          }
        }
      }`,
      {
        repositoryId: repoId,
        categoryId: categoryId,
        body: body,
        title: title,
      }
    );
  }
}
