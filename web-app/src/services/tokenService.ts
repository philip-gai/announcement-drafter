import { Container, CosmosClient } from "@azure/cosmos";
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
  refreshTokenCreatedAt: string;
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

  async getRefreshToken(options: GetRefreshTokenOptions): Promise<TokenItem | undefined> {
    this._logger.info(`Getting refresh token...`);
    this._logger.debug(`Options: ${JSON.stringify(options)}`);
    const itemResponse = await this._container.item(options.userLogin, options.userLogin).read<TokenItem>();
    this._logger.trace(JSON.stringify(itemResponse.resource));

    const token = itemResponse.resource;

    if (!token) this._logger.info("No token found for the user");

    if (!this.refreshTokenIsValid(token)) return undefined;

    return token;
  }

  async upsertRefreshToken(
    token: string,
    refreshToken: string,
    refreshTokenExpiresAt: string,
    userLogin?: string,
    refreshTokenCreatedAt: string = new Date(Date.now()).toISOString()
  ): Promise<void> {
    this._logger.info(`Begin upsert refresh token method...`);
    let login = userLogin;

    if (!login) {
      this._logger.info(`Creating octokit from user token...`);
      const myOctokit = new ProbotOctokit({
        auth: { token: token },
        log: this._logger,
      });

      this._logger.info(`Getting the authenticated user...`);
      const user = await myOctokit.users.getAuthenticated();
      login = user.data.login;
    }

    this._logger.info(`Upserting refreshToken for user ${login}`);
    await this._container.items.upsert<TokenItem>({
      id: login,
      refreshToken: refreshToken,
      refreshTokenExpiresAt: refreshTokenExpiresAt,
      refreshTokenCreatedAt: refreshTokenCreatedAt,
    });
    this._logger.info("Upsert complete");
  }

  public refreshTokenIsValid(refreshToken: TokenItem | undefined): boolean {
    if (!refreshToken) {
      this._logger.info("No refresh token found for the user");
      return false;
    }
    if (Date.now() > Date.parse(refreshToken.refreshTokenExpiresAt)) {
      this._logger.info("The refresh token is expired");
      return false;
    }
    return true;
  }

  public async deleteRefreshToken(userLogin: string): Promise<void> {
    this._logger.info(`Deleting user token for "${userLogin}"`);
    try {
      const item = this._container.item(userLogin, userLogin);
      await item.delete();
      this._logger.info("Deleted user token.");
    } catch {
      this._logger.info("No token found for the user.");
    }
  }

  async refreshUserToken(userLogin: string): Promise<string> {
    this._logger.info(`Refreshing user token for ${userLogin}`);
    const userRefreshToken = await this.getRefreshToken({
      userLogin: userLogin,
    });

    if (!userRefreshToken || !this.refreshTokenIsValid(userRefreshToken)) {
      throw new Error("User needs to re-authenticate");
    }

    this._logger.info("Getting a new token from the refresh token...");
    const refreshTokenResponse = await refreshToken({
      clientType: "github-app",
      clientId: this._appConfig.github_client_id,
      clientSecret: this._appConfig.github_client_secret,
      refreshToken: userRefreshToken.refreshToken,
    });

    const { activeToken, updatedRefreshToken, updatedRefreshTokenExpiresAt } = {
      activeToken: refreshTokenResponse.authentication.token,
      updatedRefreshToken: refreshTokenResponse.authentication.refreshToken,
      updatedRefreshTokenExpiresAt: refreshTokenResponse.authentication.refreshTokenExpiresAt,
    };

    this._logger.info("Upserting the newest refresh token...");
    await this.upsertRefreshToken(activeToken, updatedRefreshToken, updatedRefreshTokenExpiresAt, userLogin);

    return activeToken;
  }
}
