import { Context } from "probot";
import type { Logger } from "probot";
import { AppConfig } from "../models/appConfig";
import { AppSettings } from "../models/appSettings";

export class ConfigService {
  static readonly prodAppId = "145106";
  static defaultConfig: AppConfig = this.getDefaultConfig();

  readonly appConfig: AppConfig;

  private constructor(appConfig: AppConfig) {
    this.appConfig = appConfig;
  }

  static async build(logger: Logger, context?: Context<"pull_request">): Promise<ConfigService> {
    const config = await this.loadConfig(logger, context);
    if (!config) throw new Error("No config was found");
    const errorMessages = ConfigService.validateConfig(config);
    if (errorMessages.length > 0) {
      const errorStr = errorMessages.join("\n");
      logger.error(errorStr);
      throw new Error(errorStr);
    }
    return new ConfigService(config);
  }

  /** Loads the config values from environment variables and input parameters */
  private static loadConfig = async (logger: Logger, context?: Context<"pull_request">): Promise<AppConfig | null> => {
    try {
      const config = this.defaultConfig;

      if (context) {
        const defaultSettings = this.getDefaultSettings();
        const appRepoSettings = await context.config<AppSettings>("announcement-drafter.yml", defaultSettings);
        if (!appRepoSettings) logger.debug("No announcement-drafter.yml file found in the repo, using defaults...");
        else logger.debug(`Loaded repo app settings: ${JSON.stringify(appRepoSettings)}`);

        config.appSettings = appRepoSettings || defaultSettings;
      }

      if (config.appId !== ConfigService.prodAppId) {
        logger.debug(`Using dev configuration: ${JSON.stringify(config)}`);
      }

      logger.info(`App ID: ${config.appId}`);

      return config;
    } catch (error: any) {
      context?.log.error(`Exception while parsing app config yml: ${error.message}`);
      throw new Error(`Exception while parsing app config yml: ${error.message}`);
    }
  };

  private static getDefaultSettings(): AppSettings {
    return {
      watch_folders: [],
      ignore_folders: [],
    };
  }

  private static getDefaultConfig(): AppConfig {
    const defaultConfig = {
      appId: process.env["APP_ID"] || "",
      appSettings: this.getDefaultSettings(),
      auth_url: process.env["AUTH_URL"] || "",
      base_url: process.env["WEBHOOK_PROXY_URL"] || "",
      cosmos_database_id: "AnnouncementDrafter",
      cosmos_primary_key: process.env["COSMOS_PRIMARY_KEY"] || "",
      cosmos_uri: process.env["COSMOS_URI"] || "",
      dry_run_comments: process.env["DRY_RUN_COMMENTS"] === "true",
      dry_run_posts: process.env["DRY_RUN_POSTS"] === "true",
      github_callback_url: process.env["CALLBACK_URL"] || "",
      github_client_id: process.env["GITHUB_CLIENT_ID"] || "",
      github_client_secret: process.env["GITHUB_CLIENT_SECRET"] || "",
    };
    if (!ConfigService.prodAppId) {
      throw new Error("prodAppId is undefined. Make sure to set it before setting defaultConfig");
    }
    if (defaultConfig.appId !== ConfigService.prodAppId) {
      console.log(`Overriding base url to use localhost:3000 because app (${defaultConfig.appId}) is non-prod (prod app id: ${ConfigService.prodAppId})`);
      defaultConfig.base_url = "http://localhost:3000";
    }
    return defaultConfig;
  }

  /** Validates the config values, creates error messages */
  private static validateConfig(config: AppConfig): string[] {
    const errorMessages: string[] = [];
    if (!config.appId) errorMessages.push("Missing App ID (APP_ID)");
    if (!config.auth_url) errorMessages.push("Missing auth_url (AUTH_URL)");
    if (!config.base_url) errorMessages.push("Missing base_url (WEBHOOK_PROXY_URL)");
    if (!config.cosmos_primary_key) errorMessages.push("Missing cosmos_primary_key");
    if (!config.cosmos_uri) errorMessages.push("Missing cosmos_uri");
    if (!config.github_callback_url) errorMessages.push("Missing github_callback_url");
    if (!config.github_client_id) errorMessages.push("Missing github_client_id");
    if (!config.github_client_secret) errorMessages.push("Missing github_client_secret");
    return errorMessages;
  }
}
