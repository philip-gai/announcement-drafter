import { Context } from "probot";
import { ConfigService } from "./configService";

export class DependencyService {
  private _context: Context<any>;
  private constructor(context: Context<any>) {
    this._context = context;
  }

  private _configService?: ConfigService;

  async getConfigService(): Promise<ConfigService> {
    return this._configService || (await ConfigService.build(this._context));
  }

  static async build(context: Context<any>): Promise<DependencyService> {
    return new DependencyService(context);
    typeof DependencyService;
  }
}
