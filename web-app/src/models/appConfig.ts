import { AppSettings } from "./appSettings";

export interface AppConfig {
  appId: string;
  appSettings: AppSettings;
  auth_url: string;
  base_url: string;
  cosmos_database_id: string;
  cosmos_primary_key: string;
  cosmos_uri: string;
  dry_run_comments: boolean;
  dry_run_posts: boolean;
  github_callback_url: string;
  github_client_id: string;
  github_client_secret: string;
}
