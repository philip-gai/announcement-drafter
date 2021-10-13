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

  public getPostAuthor(): string {
    return this._yamlHeader.author?.replace("@", "") as string;
  }
  public getRepoName(): string {
    const repoUrl = this.getRepoUrl();
    const repoName = repoUrl.split("/").pop();
    if (!repoName) throw new Error("Unable to get repo name");
    return repoName;
  }

  private getRepoUrl() {
    return (
      (this._yamlHeader.repo as string) ||
      (this._yamlHeader.repository as string)
    );
  }

  public getRepoOwner(): string {
    const repoUrl = this.getRepoUrl();
    const owner = repoUrl.split("/")[3];
    return owner;
  }

  public getTeamOwner(): string {
    const teamUrl = this.getTeamUrl();
    const owner = teamUrl.split("/")[4];
    return owner;
  }

  public getTeamName(): string {
    const teamUrl = this.getTeamUrl();
    const teamName = teamUrl.split("/").pop();
    if (!teamName) throw new Error("Unable to get team name");
    return teamName;
  }

  private getTeamUrl(): string {
    return this._yamlHeader.team as string;
  }

  public getDiscussionCategoryName(): string {
    const rawCat = this._yamlHeader.category as string;
    const categoryName = rawCat.split("/").pop();
    if (!categoryName) throw new Error("Unable to get discussion category");
    return categoryName;
  }

  public getPostTitle(): string {
    throw new Error("Method not implemented");
  }

  public getPostBody(): string {
    throw new Error("Method not implemented");
  }
}
