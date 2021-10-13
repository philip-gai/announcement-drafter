import { Context } from "probot";
import { DeprecatedLogger } from "probot/lib/types";
import { AppConfig } from "../models/appConfig";
import { AppSettings } from "../models/appSettings";

export class ConfigService {
  static defaultConfig: AppConfig = this.getDefaultConfig();

  readonly appConfig: AppConfig;
  private _logger: DeprecatedLogger;

  private constructor(appConfig: AppConfig, logger: DeprecatedLogger) {
    this.appConfig = appConfig;
    this._logger = logger;
  }

  static async build(
    logger: DeprecatedLogger,
    context?: Context<any>
  ): Promise<ConfigService> {
    const config = await this.loadConfig(logger, context);
    if (!config) throw new Error("No config was found");
    const errorMessages = ConfigService.validateConfig(config);
    if (errorMessages.length > 0) {
      const errorStr = errorMessages.join("\n");
      logger.error(errorStr);
      throw new Error(errorStr);
    }
    return new ConfigService(config, logger);
  }

  /** Loads the config values from environment variables and input parameters */
  private static loadConfig = async (
    logger: DeprecatedLogger,
    context?: Context<any>
  ): Promise<AppConfig | null> => {
    try {
      let config = this.defaultConfig;

      if (context) {
        const defaultSettings = this.getDefaultSettings();
        const appRepoSettings = await context.config<AppSettings>(
          "repost-app.yml",
          defaultSettings
        );
        if (!appRepoSettings)
          logger.debug(
            "No repost-app.yml file found in the repo, using defaults..."
          );
        else
          logger.debug(
            `Loaded repo app settings: ${JSON.stringify(appRepoSettings)}`
          );

        config.appSettings = appRepoSettings || defaultSettings;
      }

      return config;
    } catch (e: any) {
      context?.log.error(
        `Exception while parsing app config yml: ${e.message}`
      );
      throw new Error(`Exception while parsing app config yml: ${e.message}`);
    }
  };

  private static getDefaultSettings(): AppSettings {
    return {
      watch_folders: ["docs/"],
      ignore_folders: [],
    };
  }

  private static getDefaultConfig(): AppConfig {
    return {
      cosmos_database_id: "Repost",
      cosmos_uri: process.env["COSMOS_URI"] || "",
      cosmos_primary_key: process.env["COSMOS_PRIMARY_KEY"] || "",
      github_callback_url: process.env["CALLBACK_URL"] || "",
      github_client_id: process.env["GITHUB_CLIENT_ID"] || "",
      github_client_secret: process.env["GITHUB_CLIENT_SECRET"] || "",
      appSettings: this.getDefaultSettings(),
      dry_run: process.env["DRY_RUN"] === "true",
    };
  }

  /** Validates the config values, creates error messages */
  private static validateConfig(config: AppConfig): string[] {
    const errorMessages: string[] = [];
    if (!config.cosmos_uri) errorMessages.push("Missing cosmos_uri");
    if (!config.cosmos_primary_key)
      errorMessages.push("Missing cosmos_primary_key");
    if (!config.github_callback_url)
      errorMessages.push("Missing github_callback_url");
    if (!config.github_client_id)
      errorMessages.push("Missing github_client_id");
    if (!config.github_client_secret)
      errorMessages.push("Missing github_client_secret");
    return errorMessages;
  }
}
