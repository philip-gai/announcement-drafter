import { EventPayloads } from "@octokit/webhooks";
import { Context } from "probot";
import { DependencyService } from "./services/dependencyService";

export class IssueCommentEventHandler {
  public onCreated = async (
    context: Context<EventPayloads.WebhookPayloadIssueComment>
  ): Promise<string> => {
    let resultMessage = "Did something";
    var dependencyService = DependencyService.build(context);
    return resultMessage;
  };
}
