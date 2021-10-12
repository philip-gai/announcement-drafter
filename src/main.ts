import { IssueCommentEventHandler } from "./issueCommentEventHandler";
import { ApplicationFunctionOptions, Probot } from "probot";
import { ConfigService } from "./services/configService";
import { TokenService } from "./services/tokenService";
import { AuthService } from "./services/authService";
import { RouterService } from "./services/routerService";

export = async (app: Probot, options: ApplicationFunctionOptions) => {
  try {
    app.log.info("Running Probot app...");

    app.log.debug("Initializaing services...");
    const configService = await ConfigService.build();
    const tokenService = TokenService.build(configService.appConfig, app.log);
    const authService = AuthService.build(configService.appConfig);
    RouterService.build(
      app.log,
      options,
      configService.appConfig,
      tokenService,
      authService
    )
      .addOAuthAuthorizeRoute()
      .addOAuthCallbackRoute();
    app.log.debug("Done.");

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
    throw error;
  }
};
