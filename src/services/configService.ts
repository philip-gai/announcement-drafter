import { Context } from "probot";
import { AppConfig } from "../models/appConfig";

export class ConfigService {
  static defaultConfig: AppConfig = this.getDefaultConfig();

  readonly appConfig: AppConfig;

  private constructor(appConfig: AppConfig) {
    this.appConfig = appConfig;
  }

  static async build(context?: Context<any>): Promise<ConfigService> {
    const config = await this.loadConfig(context);
    if (!config) throw new Error("No config was found");
    const errorMessages = ConfigService.validateConfig(config);
    if (errorMessages.length > 0) {
      const errorStr = errorMessages.join("\n");
      // core.error(errorStr);
      throw new Error(errorStr);
    }
    return new ConfigService(config);
  }

  /** Loads the config values from environment variables and input parameters */
  private static loadConfig = async (
    context?: Context<any>
  ): Promise<AppConfig | null> => {
    try {
      let config = this.defaultConfig;

      if (context) {
        const loadedConfig =
          (await context.config<AppConfig>("repost.yml")) ||
          (await context.config<AppConfig>("repost.yaml"));

        // ConfigService.mergeSettings(config, loadedConfig);
      }

      return config;
    } catch (e: any) {
      context?.log.error(
        `Exception while parsing app config yml: ${e.message}`
      );
      throw new Error(`Exception while parsing app config yml: ${e.message}`);
    }
  };

  // private static mergeSettings(
  //   config: AppConfig,
  //   loadedConfig: AppConfig | null
  // ) {
  //   // config.github_token = loadedConfig?.github_token || config.github_token;
  // }

  private static getDefaultConfig(): AppConfig {
    return {
      cosmos_database_id: "Repost",
      cosmos_uri: process.env["COSMOS_URI"] || "",
      cosmos_primary_key: process.env["COSMOS_PRIMARY_KEY"] || "",
      github_callback_url: process.env["CALLBACK_URL"] || "",
      github_client_id: process.env["GITHUB_CLIENT_ID"] || "",
      github_client_secret: process.env["GITHUB_CLIENT_SECRET"] || "",
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
