import { Octokit } from "@octokit/core";
import { ProbotOctokit } from "probot";
import YAML from "yaml";

export class ParserService {
  private _content: string;
  private _yamlHeader: any;

  private constructor(fileContent: string) {
    this._content = fileContent;
    this._yamlHeader = this.parseYamlHeader(fileContent);
  }

  static build(fileContent: string): ParserService {
    return new ParserService(fileContent);
  }

  // https://www.npmjs.com/package/yaml
  private parseYamlHeader(content: string): any {
    const startIndex = content.indexOf("<!--") + "<!--".length;
    const endIndex = content.indexOf("-->");
    const yamlStr = content.substring(startIndex, endIndex);
    const yaml = YAML.parse(yamlStr);
    return yaml;
  }

  public getAuthor(): string {
    return this._yamlHeader.author?.replace("@", "") as string;
  }
  public getRepository(): string {
    const repoUrl = this.getRepoUrl();

    const startIndex = repoUrl.lastIndexOf("/");
    const repoName = repoUrl.substring(startIndex);
    return repoName;
  }

  private getRepoUrl() {
    return (
      (this._yamlHeader.repo as string) ||
      (this._yamlHeader.repository as string)
    );
  }

  public getOwner(): string {
    const repoUrl = this.getRepoUrl();
    const owner = repoUrl.replace("https://github.com/", "").split("/")[0];
    return owner;
  }

  public getTeam(): string {
    return this._yamlHeader.team as string;
  }
  public getDiscussionCategory(): string {
    return this._yamlHeader.category as string;
  }
  public getPostTitle(): string {
    throw new Error("Method not implemented");
  }
  public getPostBody(): string {
    throw new Error("Method not implemented");
  }
}
