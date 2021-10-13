import { EventPayloads } from "@octokit/webhooks";
import { Context } from "probot";
import { ConfigService } from "../services/configService";
import { GitHubService, OctokitPlus } from "../services/githubService";
import { ParserService } from "../services/parserService";
import { TokenService } from "../services/tokenService";

export class PushEventHandler {
  private _tokenService: TokenService;
  private constructor(tokenService: TokenService) {
    this._tokenService = tokenService;
  }

  public static build(tokenService: TokenService) {
    return new PushEventHandler(tokenService);
  }

  public onPush = async (
    context: Context<EventPayloads.WebhookPayloadPush>
  ): Promise<void> => {
    const isDefaultBranch =
      context.payload.ref ===
      "refs/heads/" + context.payload.repository.default_branch;
    const filesAdded = context.payload.commits.flatMap(
      (commit) => commit.added
    ) as string[];
    const filesToPost = filesAdded.filter(
      (file) => file.includes("docs/team-posts") // TODO - Make location configurable
    );
    const repo = context.payload.repository.name;
    const owner = context.payload.repository.owner.name || "";
    if (!owner) throw new Error("Missing repository owner (org) data");

    // TODO - Where is this?
    // const hasDiscussions = context.payload.repository.has_discussions

    if (isDefaultBranch && filesToPost.length > 0) {
      const appGitHubService = GitHubService.buildForApp(
        context.octokit as unknown as OctokitPlus,
        context.log
      );

      // example filepath: "docs/team-posts/hello-world.md"
      for (const filepath in filesToPost) {
        const fileContent = await appGitHubService.getFileContent(
          owner,
          repo,
          filepath
        );

        const parserService = ParserService.build(JSON.stringify(fileContent));
        const authorLogin = parserService.getPostAuthor();
        const token = await this._tokenService.refreshUserToken(authorLogin);
        // TODO - if unable to refresh, create an issue and assign to author
        // Once author clicks the link, comment back that it was successful
        const userGithubService = GitHubService.buildForUser(
          token,
          context.log
        );

        const postRepo = parserService.getRepoName();
        const postTeam = parserService.getTeamName();
        const discussionCategoryName =
          parserService.getDiscussionCategoryName();
        const postBody = parserService.getPostBody();
        const postTitle = parserService.getPostTitle();
        if (postRepo) {
          await userGithubService.createRepoDiscussion(
            postRepo,
            discussionCategoryName,
            postBody,
            postTitle
          );
        }
        if (postTeam) {
          await userGithubService.createOrgTeamDiscussion(
            parserService.getTeamOwner(),
            postTeam,
            postTitle,
            postBody
          );
        }
      }
    }
  };
}
