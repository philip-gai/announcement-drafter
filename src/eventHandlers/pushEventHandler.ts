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
    const logger = context.log;
    logger.info("Executing onPush handler...");
    const isDefaultBranch =
      context.payload.ref ===
      "refs/heads/" + context.payload.repository.default_branch;

    logger.debug(`isDefaultBranch: ${isDefaultBranch}`);

    const filesAdded = context.payload.commits.flatMap(
      (commit) => commit.added
    ) as string[];

    logger.debug(`# files added in push: ${filesAdded.length}`);
    logger.debug(`Files: ${filesAdded.join(", ")}`);

    const filesToPost = filesAdded.filter(
      (file) => file.includes("docs/team-posts") // TODO - Make location configurable
    );

    logger.debug(`# files to post: ${filesToPost.length}`);
    logger.debug(`Files: ${filesToPost.join(", ")}`);

    const repo = context.payload.repository.name;
    const owner = context.payload.repository.owner.name || "";
    if (!owner) throw new Error("Missing repository owner (org) data");

    // TODO - Where is this?
    // const hasDiscussions = context.payload.repository.has_discussions

    if (isDefaultBranch && filesToPost.length > 0) {
      const appGitHubService = GitHubService.buildForApp(
        context.octokit as unknown as OctokitPlus,
        logger
      );

      // example filepath: "docs/team-posts/hello-world.md"
      for (const index in filesToPost) {
        const filepath = filesToPost[index];
        const fileContent = await appGitHubService.getFileContent(
          owner,
          repo,
          filepath
        );

        const parserService = ParserService.build(fileContent, logger);
        const authorLogin = parserService.getPostAuthor();
        logger.debug(`Author Login: ${authorLogin}`);

        const token = await this._tokenService.refreshUserToken(authorLogin);
        // TODO - if unable to refresh, create an issue and assign to author
        // Once author clicks the link, comment back that it was successful
        const userGithubService = GitHubService.buildForUser(token, logger);

        const parsedItems = parserService.getParsedDocument();

        logger.debug(`Parsed Document Items: ${JSON.stringify(parsedItems)}`);

        if (parsedItems.targetRepoName) {
          const targetRepoOwner = parserService.getTargetRepoOwner();
          if (!targetRepoOwner)
            throw new Error(
              "Missing target repo owner - repo url should include the owner (org)"
            );
          const repoData = await appGitHubService.getRepoData(
            parsedItems.targetRepoName,
            targetRepoOwner
          );
          logger.trace(`repoData: ${JSON.stringify(repoData)}`);
          const repoDiscussionCategories =
            await appGitHubService.getRepoDiscussionCategories(
              parsedItems.targetRepoName,
              targetRepoOwner
            );
          const discussionCategoryMatch = repoDiscussionCategories.find(
            (node) =>
              node.name
                .trim()
                .localeCompare(parsedItems.discussionCategoryName, undefined, {
                  sensitivity: "accent",
                })
          );
          if (!discussionCategoryMatch)
            throw new Error("Could not find discussion category node");

          await userGithubService.createRepoDiscussion(
            repoData.node_id,
            discussionCategoryMatch.id,
            parsedItems.postBody,
            parsedItems.postTitle
          );
        }
        if (parsedItems.targetTeamName) {
          const targetTeamOwner = parserService.getTargetTeamOwner();
          if (!targetTeamOwner)
            throw new Error(
              "The url to the team is not valid - it must include the team owner (org)"
            );
          await userGithubService.createOrgTeamDiscussion(
            targetTeamOwner,
            parsedItems.targetTeamName,
            parsedItems.postTitle,
            parsedItems.postBody
          );
        }
      }
    }
  };
}
