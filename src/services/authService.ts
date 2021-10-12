import {
  exchangeWebFlowCode,
  GitHubAppAuthenticationWithRefreshToken,
} from "@octokit/oauth-methods";
import { AppConfig } from "../models/appConfig";
import * as queryString from "query-string";

export class AuthService {
  private _appConfig: AppConfig;
  private constructor(appConfig: AppConfig) {
    this._appConfig = appConfig;
  }

  public static build(appConfig: AppConfig): AuthService {
    return new AuthService(appConfig);
  }

  public getGitHubOAuthUrl(req: any): string {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");

    const params = queryString.stringify({
      client_id: this._appConfig.github_client_id,
      redirect_uri: `${protocol}://${host}${this._appConfig.github_callback_url}`,
    });

    const url = `https://github.com/login/oauth/authorize?${params}`;
    return url;
  }

  async authenticateUser(code: string) {
    const tokenResponse = await exchangeWebFlowCode({
      clientType: "github-app",
      clientId: this._appConfig.github_client_id,
      clientSecret: this._appConfig.github_client_secret,
      code: code,
    });

    const authentication =
      tokenResponse.authentication as GitHubAppAuthenticationWithRefreshToken;

    // Authenticate our Octokit client with the new token
    const { token, refreshToken, refreshTokenExpiresAt } = {
      token: authentication.token,
      refreshToken: authentication.refreshToken,
      refreshTokenExpiresAt: authentication.refreshTokenExpiresAt,
    };
    if (!token) throw new Error("Bad token");
    if (!refreshToken) throw new Error("Bad refresh token");
    if (!refreshTokenExpiresAt) throw new Error("Bad refreshTokenExpiresAt");

    return { token, refreshToken, refreshTokenExpiresAt };
  }
}
