import type { ApplicationFunctionOptions, Logger } from "probot";
import { Router } from "express";
import { AppConfig } from "../models/appConfig";
import { TokenService } from "./tokenService";
import { AuthService } from "./authService";
import { decrypt } from "./cryptoService";
import crypto from "crypto";
import pug from "pug";
import { authSuccessTemplate } from "../templates/authorization";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const stringify = require("js-stringify");

export class RouterService {
  private _router: Router;
  private _logger: Logger;
  private _appConfig: AppConfig;
  private _tokenService: TokenService;
  private _authService: AuthService;
  static readonly SECONDS_TO_REDIRECT = 6;
  static readonly DEFAULT_REDIRECT = "https://github.com/philip-gai/announcement-drafter";

  private constructor(logger: Logger, options: ApplicationFunctionOptions, appConfig: AppConfig, tokenService: TokenService, authService: AuthService) {
    this._logger = logger;
    const router = options.getRouter && options.getRouter("/");
    if (!router) throw new Error("Invalid router");
    this._router = router;
    this._router.use((_, res, next) => {
      res.setHeader("Content-Security-Policy", "default-src 'none'");
      res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.setHeader("X-Xss-Protection", "0");
      return next();
    });
    this._appConfig = appConfig;
    this._tokenService = tokenService;
    this._authService = authService;
  }

  public static build(
    logger: Logger,
    options: ApplicationFunctionOptions,
    appConfig: AppConfig,
    tokenService: TokenService,
    authService: AuthService,
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
        const decryptedState = decrypt(encryptedState, this._appConfig.github_client_secret);

        const state = JSON.parse(decryptedState);
        if (state.github_client_id !== this._appConfig.github_client_id) {
          res.status(400).send("Invalid state");
          return;
        }
        // Get the pull request url from the state for redirection
        if (state.pull_url && this.isValidHttpUrl(state.pull_url)) {
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
      const nonce = crypto.randomBytes(16).toString("base64") as string;
      res.setHeader("Content-Security-Policy", `script-src 'nonce-${nonce}'; default-src 'none'`);
      const html = pug.render(authSuccessTemplate, {
        redirectLocationText,
        redirectUrl,
        secondsToRedirect: RouterService.SECONDS_TO_REDIRECT,
        stringify,
        nonce,
      });
      this._logger.debug("Template: " + html);
      res.status(200).send(html);
    });
    return this;
  }

  public addHealthCheckRoute(): this {
    this._router.get("/health", (_req, res) => {
      res.status(200).send("Success");
    });
    return this;
  }

  private isValidHttpUrl(string: string): boolean {
    let url;
    try {
      url = new URL(string);
    } catch (_) {
      return false;
    }
    return url.protocol === "http:" || url.protocol === "https:";
  }
}
