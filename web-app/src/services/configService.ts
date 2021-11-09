import { Context } from 'probot';
import { DeprecatedLogger } from 'probot/lib/types';
import { AppConfig } from '../models/appConfig';
import { AppSettings } from '../models/appSettings';

export class ConfigService {
  static defaultConfig: AppConfig = this.getDefaultConfig();

  readonly appConfig: AppConfig;

  private constructor(appConfig: AppConfig) {
    this.appConfig = appConfig;
  }

  static async build(logger: DeprecatedLogger, context?: Context<any>): Promise<ConfigService> {
    const config = await this.loadConfig(logger, context);
    if (!config) throw new Error('No config was found');
    const errorMessages = ConfigService.validateConfig(config);
    if (errorMessages.length > 0) {
      const errorStr = errorMessages.join('\n');
      logger.error(errorStr);
      throw new Error(errorStr);
    }
    return new ConfigService(config);
  }

  /** Loads the config values from environment variables and input parameters */
  private static loadConfig = async (logger: DeprecatedLogger, context?: Context<any>): Promise<AppConfig | null> => {
    try {
      let config = this.defaultConfig;

      if (context) {
        const defaultSettings = this.getDefaultSettings();
        const appRepoSettings = await context.config<AppSettings>('announcement-drafter.yml', defaultSettings);
        if (!appRepoSettings) logger.debug('No announcement-drafter.yml file found in the repo, using defaults...');
        else logger.debug(`Loaded repo app settings: ${JSON.stringify(appRepoSettings)}`);

        config.appSettings = appRepoSettings || defaultSettings;
      }

      return config;
    } catch (e: any) {
      context?.log.error(`Exception while parsing app config yml: ${e.message}`);
      throw new Error(`Exception while parsing app config yml: ${e.message}`);
    }
  };

  private static getDefaultSettings(): AppSettings {
    return {
      watch_folders: [],
      ignore_folders: []
    };
  }

  private static getDefaultConfig(): AppConfig {
    return {
      cosmos_database_id: 'Repost',
      cosmos_uri: process.env['COSMOS_URI'] || '',
      cosmos_primary_key: process.env['COSMOS_PRIMARY_KEY'] || '',
      github_callback_url: process.env['CALLBACK_URL'] || '',
      github_client_id: process.env['GITHUB_CLIENT_ID'] || '',
      github_client_secret: process.env['GITHUB_CLIENT_SECRET'] || '',
      appSettings: this.getDefaultSettings(),
      dry_run_comments: process.env['DRY_RUN_COMMENTS'] === 'true',
      dry_run_posts: process.env['DRY_RUN_POSTS'] === 'true',
      base_url: process.env['WEBHOOK_PROXY_URL'] || '',
      auth_url: process.env['AUTH_URL'] || ''
    };
  }

  /** Validates the config values, creates error messages */
  private static validateConfig(config: AppConfig): string[] {
    const errorMessages: string[] = [];
    if (!config.cosmos_uri) errorMessages.push('Missing cosmos_uri');
    if (!config.cosmos_primary_key) errorMessages.push('Missing cosmos_primary_key');
    if (!config.github_callback_url) errorMessages.push('Missing github_callback_url');
    if (!config.github_client_id) errorMessages.push('Missing github_client_id');
    if (!config.github_client_secret) errorMessages.push('Missing github_client_secret');
    if (!config.base_url) errorMessages.push('Missing base_url (WEBHOOK_PROXY_URL)');
    if (!config.auth_url) errorMessages.push('Missing auth_url (AUTH_URL)');
    return errorMessages;
  }
}
