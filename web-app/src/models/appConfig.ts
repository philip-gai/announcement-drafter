import { AppSettings } from './appSettings';

export interface AppConfig {
  cosmos_database_id: string;
  cosmos_uri: string;
  cosmos_primary_key: string;
  github_client_id: string;
  github_callback_url: string;
  github_client_secret: string;
  appSettings: AppSettings;
  dry_run_posts: boolean;
  dry_run_comments: boolean;
  base_url: string;
  auth_url: string;
}
