import { exchangeWebFlowCode, GitHubAppAuthenticationWithRefreshToken } from "@octokit/oauth-methods";
import { AppConfig } from "../models/appConfig";
import * as queryString from "query-string";
import { DeprecatedLogger } from "probot/lib/types";
import CryptoJS from "crypto-js";

export class AuthService {
  private _appConfig: AppConfig;
  private _logger: DeprecatedLogger;

  private constructor(appConfig: AppConfig, logger: DeprecatedLogger) {
    this._appConfig = appConfig;
    this._logger = logger;
  }

  public static build(appConfig: AppConfig, logger: DeprecatedLogger): AuthService {
    return new AuthService(appConfig, logger);
  }

  public getGitHubOAuthUrl(req: any): string {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");

    // Encrypt
    const state = {
      pull_url: req.query.pull_url,
      github_client_id: this._appConfig.github_client_id,
    };
    const encryptedState = CryptoJS.AES.encrypt(JSON.stringify(state), this._appConfig.github_client_secret).toString();

    const params = queryString.stringify({
      client_id: this._appConfig.github_client_id,
      redirect_uri: `${protocol}://${host}${this._appConfig.github_callback_url}`,
      state: encryptedState,
    });

    const url = `https://github.com/login/oauth/authorize?${params}`;
    return url;
  }

  async authenticateUser(code: string): Promise<{ token: string; refreshToken: string; refreshTokenExpiresAt: string }> {
    this._logger.info("Authenticating the user by exchanging OAuth code for a token");
    const tokenResponse = await exchangeWebFlowCode({
      clientType: "github-app",
      clientId: this._appConfig.github_client_id,
      clientSecret: this._appConfig.github_client_secret,
      code: code,
    });

    const authentication = tokenResponse.authentication as GitHubAppAuthenticationWithRefreshToken;

    // Authenticate our Octokit client with the new token
    const { token, refreshToken, refreshTokenExpiresAt } = {
      token: authentication.token,
      refreshToken: authentication.refreshToken,
      refreshTokenExpiresAt: authentication.refreshTokenExpiresAt,
    };
    if (!token) throw new Error("Bad token");
    if (!refreshToken) throw new Error("Bad refresh token");
    if (!refreshTokenExpiresAt) throw new Error("Bad refreshTokenExpiresAt");

    this._logger.info("Received a valid token and refresh token");

    return { token, refreshToken, refreshTokenExpiresAt };
  }
}
