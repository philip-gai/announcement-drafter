import { ApplicationFunctionOptions, Probot } from "probot";
import { ConfigService } from "./services/configService";
import { TokenService } from "./services/tokenService";
import { AuthService } from "./services/authService";
import { RouterService } from "./services/routerService";
import { HelperService } from "./services/helperService";
import { PullRequestEventHandler } from "./eventHandlers/pullRequestEventHandler";

export = async (app: Probot, options: ApplicationFunctionOptions): Promise<void> => {
  const logger = app.log;
  try {
    logger.info("Running Probot app...");

    logger.debug("Initializaing services...");
    const configService = await ConfigService.build(logger);
    const tokenService = TokenService.build(configService.appConfig, logger);
    const authService = AuthService.build(configService.appConfig, logger);
    RouterService.build(logger, options, configService.appConfig, tokenService, authService)
      .addOAuthAuthorizeRoute()
      .addOAuthCallbackRoute()
      .addHealthCheckRoute();
    logger.debug("Done.");

    app.on(["pull_request.opened", "pull_request.synchronize", "pull_request.ready_for_review", "pull_request.reopened"], async (context) => {
      const pullRequestEventHandler = await PullRequestEventHandler.build(context, tokenService);
      await pullRequestEventHandler.onUpdated(context);
    });
    app.on("pull_request.closed", async (context) => {
      if (!context.payload.pull_request.merged) {
        logger.info("Pull request was closed but not merged. Skipping.");
        return;
      }
      const pullRequestEventHandler = await PullRequestEventHandler.build(context, tokenService);
      await pullRequestEventHandler.onMerged(context);
    });
  } catch (error: unknown) {
    const errorMessage = HelperService.getErrorMessage(error);
    logger.error(errorMessage);
    throw error;
  }
};
