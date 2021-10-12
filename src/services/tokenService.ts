import { Container, CosmosClient, Database } from "@azure/cosmos";
import { refreshToken } from "@octokit/oauth-methods";
import { ProbotOctokit } from "probot";
import { DeprecatedLogger } from "probot/lib/types";
import { AppConfig } from "../models/appConfig";

export interface GetRefreshTokenOptions {
  userLogin: string;
}

export interface TokenItem {
  id: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export class TokenService {
  private _container: Container;
  private _appConfig: AppConfig;
  private _logger: DeprecatedLogger;

  private constructor(appConfig: AppConfig, logger: DeprecatedLogger) {
    const client = new CosmosClient({
      endpoint: appConfig.cosmos_uri,
      key: appConfig.cosmos_primary_key,
    });
    const database = client.database(appConfig.cosmos_database_id);
    this._container = database.container("Tokens");
    this._appConfig = appConfig;
    this._logger = logger;
  }

  static build(appConfig: AppConfig, logger: DeprecatedLogger): TokenService {
    return new TokenService(appConfig, logger);
  }

  async getRefreshToken(
    options: GetRefreshTokenOptions
  ): Promise<TokenItem | undefined> {
    const itemResponse = await this._container
      .item(options.userLogin)
      .read<TokenItem>();

    console.log(JSON.stringify(itemResponse));

    const token = itemResponse.resource;
    return token;
  }

  async upsertRefreshToken(
    token: string,
    refreshToken: string,
    refreshTokenExpiresAt: string
  ) {
    const myOctokit = new ProbotOctokit({
      auth: { token: token },
      log: this._logger.child({ name: "my-octokit" }),
    });

    const user = await myOctokit.users.getAuthenticated();

    await this._container.items.upsert<TokenItem>({
      id: user.data.login,
      refreshToken: refreshToken,
      refreshTokenExpiresAt: refreshTokenExpiresAt,
    });
  }

  async refreshUserToken(userLogin: string) {
    const userRefreshToken = await this.getRefreshToken({
      userLogin: userLogin,
    });
    if (!userRefreshToken) throw new Error("TODO: Please authenticate");
    if (Date.now() > Date.parse(userRefreshToken.refreshTokenExpiresAt))
      throw new Error("TODO: Please re-authenticate");

    const refreshTokenResponse = await refreshToken({
      clientType: "github-app",
      clientId: this._appConfig.github_client_id,
      clientSecret: this._appConfig.github_client_secret,
      refreshToken: userRefreshToken.refreshToken,
    });

    const { activeToken, updatedRefreshToken, updatedRefreshTokenExpiresAt } = {
      activeToken: refreshTokenResponse.authentication.token,
      updatedRefreshToken: refreshTokenResponse.authentication.refreshToken,
      updatedRefreshTokenExpiresAt:
        refreshTokenResponse.authentication.refreshTokenExpiresAt,
    };

    await this.upsertRefreshToken(
      activeToken,
      updatedRefreshToken,
      updatedRefreshTokenExpiresAt
    );

    return activeToken;
  }
}
