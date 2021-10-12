import { Context } from "probot";
import { AppConfig } from "../models/appConfig";

export class ConfigService {
  readonly appConfig: AppConfig;

  private constructor(appConfig: AppConfig) {
    this.appConfig = appConfig;
  }

  static async build(context: Context<any>): Promise<ConfigService> {
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
    context: Context<any>
  ): Promise<AppConfig | null> => {
    try {
      let loadedConfig =
        (await context.config<AppConfig>("repost.yml")) ||
        (await context.config<AppConfig>("repost.yaml"));
      return loadedConfig;
    } catch (e: any) {
      context.log.error(
        `Exception while parsing app config yaml: ${e.message}`
      );
      throw new Error(`Exception while parsing app config yaml: ${e.message}`);
    }
  };

  /** Validates the config values, creates error messages */
  private static validateConfig(config: AppConfig): string[] {
    const errorMessages: string[] = [];
    if (!config.exampleApiClientId)
      errorMessages.push("No exampleApiClientId was found. Check your inputs");
    if (!config.exampleApiClientSecret)
      errorMessages.push(
        "No exampleApiClientSecret was found. Check your inputs"
      );
    return errorMessages;
  }
}
