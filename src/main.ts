import { IssueCommentEventHandler } from "./issueCommentEventHandler";
import { Probot } from "probot";

export = async (app: Probot) => {
  try {
    app.log.info("Running Probot app...");

    app.log.debug("Initializaing event handlers...");
    const issueCommentEventHandler = new IssueCommentEventHandler();
    app.log.debug("Done.");

    app.on("issue_comment.created", (context) =>
      issueCommentEventHandler.onCreated(context)
    );
  } catch (error: unknown) {
    let errorMessage = "An unknown error has occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }
    app.log.error(errorMessage);
  }
};
