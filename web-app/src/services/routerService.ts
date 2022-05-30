import { ApplicationFunctionOptions, DeprecatedLogger } from "probot/lib/types";
import { Router } from "express";
import { AppConfig } from "../models/appConfig";
import { TokenService } from "./tokenService";
import { AuthService } from "./authService";
import CryptoJS from "crypto-js";

export class RouterService {
  private _router: Router;
  private _logger: DeprecatedLogger;
  private _appConfig: AppConfig;
  private _tokenService: TokenService;
  private _authService: AuthService;
  static readonly SECONDS_TO_REDIRECT = 6;
  static readonly DEFAULT_REDIRECT = "https://github.com/philip-gai/announcement-drafter";

  private constructor(
    logger: DeprecatedLogger,
    options: ApplicationFunctionOptions,
    appConfig: AppConfig,
    tokenService: TokenService,
    authService: AuthService
  ) {
    this._logger = logger;
    const router = options.getRouter && options.getRouter("/");
    if (!router) throw new Error("Invalid router");
    this._router = router;
    this._appConfig = appConfig;
    this._tokenService = tokenService;
    this._authService = authService;
  }

  public static build(
    logger: DeprecatedLogger,
    options: ApplicationFunctionOptions,
    appConfig: AppConfig,
    tokenService: TokenService,
    authService: AuthService
  ): RouterService {
    return new RouterService(logger, options, appConfig, tokenService, authService);
  }

  public addOAuthAuthorizeRoute(): this {
    this._router.get("/login/oauth/authorize", (req, res) => {
      const redirectUrl = this._authService.getGitHubOAuthUrl(req);
      this._logger.info(`Redirecting user to ${redirectUrl}`);
      res.redirect(redirectUrl);
    });
    return this;
  }

  public addOAuthCallbackRoute(): this {
    this._router.get(this._appConfig.github_callback_url, async (req, res): Promise<void> => {
      this._logger.info(`Received OAuth callback...`);
      const code = req.query.code as string;
      if (!code) {
        res.status(400).send("No code");
        return;
      }

      const encryptedState = req.query.state as string;
      if (!encryptedState) {
        res.status(400).send("No state");
        return;
      }

      // Redirect to the DEFAULT_REDIRECT if no pull request url is found
      let redirectUrl = RouterService.DEFAULT_REDIRECT;
      try {
        // Decrypt the state and validate it
        const bytes = CryptoJS.AES.decrypt(encryptedState, this._appConfig.github_client_secret);

        const state = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        if (state.github_client_id !== this._appConfig.github_client_id) {
          res.status(400).send("Invalid state");
          return;
        }
        // Get the pull request url from the state for redirection
        if (state.pull_url) {
          redirectUrl = state.pull_url;
        }
      } catch (error) {
        res.status(400).send("Unable to parse state");
        return;
      }

      const { token, refreshToken, refreshTokenExpiresAt } = await this._authService.authenticateUser(code);

      await this._tokenService.upsertRefreshToken(token, refreshToken, refreshTokenExpiresAt);

      // Display authentication success message and redirect after SECONDS_TO_REDIRECT seconds
      const redirectLocationText = redirectUrl !== RouterService.DEFAULT_REDIRECT ? "pull request" : "Announcement Drafter repository";
      res.setHeader("Content-Type", "text/html");
      res.status(200).send(`
        <html>
        <head>
          <title>announcement-drafter | authorization</title>
        </head>
        <body>
          <div><h2>Success! Now Announcement Drafter can create discussions for you 🚀</h2></div>
          <div><p>Sending you back to the ${redirectLocationText} in just a few seconds...</p></div>
        </body>
        <script>
          setTimeout(function () {
            window.location = "${redirectUrl}";
          }, ${RouterService.SECONDS_TO_REDIRECT * 1000})
        </script>
        </html>
        `);
    });
    return this;
  }

  public addHealthCheckRoute(): this {
    this._router.get("/health", (_req, res) => {
      res.status(200).send("Success");
    });
    return this;
  }
}
