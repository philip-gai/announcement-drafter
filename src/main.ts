import { ApplicationFunctionOptions, Probot } from "probot";
import { ConfigService } from "./services/configService";
import { TokenService } from "./services/tokenService";
import { AuthService } from "./services/authService";
import { RouterService } from "./services/routerService";
import { PushEventHandler } from "./eventHandlers/pushEventHandler";

export = async (app: Probot, options: ApplicationFunctionOptions) => {
  const logger = app.log;
  try {
    logger.info("Running Probot app...");

    logger.debug("Initializaing services...");
    const configService = await ConfigService.build();
    const tokenService = TokenService.build(configService.appConfig, logger);
    const authService = AuthService.build(configService.appConfig, logger);
    RouterService.build(
      logger,
      options,
      configService.appConfig,
      tokenService,
      authService
    )
      .addOAuthAuthorizeRoute()
      .addOAuthCallbackRoute();
    logger.debug("Done.");

    logger.debug("Initializaing event handlers...");
    const pushEventHandler = PushEventHandler.build(tokenService);
    logger.debug("Done.");

    app.on("push", async (context) => {
      await pushEventHandler.onPush(context);
    });
  } catch (error: unknown) {
    let errorMessage = "An unknown error has occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }
    logger.error(errorMessage);
    throw error;
  }
};
