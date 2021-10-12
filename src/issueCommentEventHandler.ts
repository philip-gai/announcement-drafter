import { EventPayloads } from "@octokit/webhooks";
import { Context } from "probot";
import { ConfigService } from "./services/configService";

export class IssueCommentEventHandler {
  public onCreated = async (
    context: Context<EventPayloads.WebhookPayloadIssueComment>
  ): Promise<string> => {
    let resultMessage = "Did something";
    const configService = await ConfigService.build(context);
    return resultMessage;
  };
}
