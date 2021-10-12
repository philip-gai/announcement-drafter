import { ApplicationFunctionOptions, DeprecatedLogger } from "probot/lib/types";
import { Router } from "express";
import { AppConfig } from "../models/appConfig";
import { TokenService } from "./tokenService";
import { AuthService } from "./authService";

export class RouterService {
  private _router: Router;
  private _logger: DeprecatedLogger;
  private _appConfig: AppConfig;
  private _tokenService: TokenService;
  private _authService: AuthService;

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
    return new RouterService(
      logger,
      options,
      appConfig,
      tokenService,
      authService
    );
  }

  public addOAuthAuthorizeRoute(): this {
    this._router.get("/login/oauth/authorize", (req, res) => {
      const redirectUrl = this._authService.getGitHubOAuthUrl(req);
      res.redirect(redirectUrl);
    });
    return this;
  }

  public addOAuthCallbackRoute(): this {
    this._router.get(this._appConfig.github_callback_url, async (req, res) => {
      const code = (req.query.code as string) || "Bad code";

      const { token, refreshToken, refreshTokenExpiresAt } =
        await this._authService.authenticateUser(code);

      await this._tokenService.upsertRefreshToken(
        token,
        refreshToken,
        refreshTokenExpiresAt
      );

      res.redirect("/");
    });
    return this;
  }
}
