import type { Logger } from "probot";
import YAML from "yaml";

export interface ParsedMarkdownDiscussion {
  repo: string | undefined;
  repoOwner: string | undefined;
  team: string | undefined;
  teamOwner: string | undefined;
  discussionCategoryName: string | undefined;
  labels: string[];
  postBody: string;
  postTitle: string;
  headerEndLine: number;
}

export class ParserService {
  private _content: string;
  private _yamlHeader?: Record<string, unknown>;
  private _logger: Logger;
  private _fileLines?: string[];

  private constructor(fileContent: string, logger: Logger) {
    this._content = fileContent;
    this._logger = logger;
  }

  static build(fileContent: string, logger: Logger): ParserService {
    return new ParserService(fileContent, logger);
  }

  private getYamlHeader(): Record<string, unknown> {
    if (!this._yamlHeader) this._yamlHeader = this.parseYamlHeader(this._content);
    return this._yamlHeader;
  }

  // https://www.npmjs.com/package/yaml
  private parseYamlHeader(content: string): Record<string, unknown> {
    try {
      this._logger.info("Parsing YAML from the markdown comment header...");
      const startIndex = content.indexOf("<!--") + "<!--".length;
      const endIndex = content.indexOf("-->");
      const yamlStr = content.substring(startIndex, endIndex);
      this._logger.debug(yamlStr);
      const yaml = YAML.parse(yamlStr) as Record<string, unknown>;
      return yaml;
    } catch (_err) {
      throw new Error("The YAML provided was invalid.");
    }
  }

  private getTargetRepoUrl(): string | undefined {
    return (this.getYamlHeader().repo as string) || (this.getYamlHeader().repository as string);
  }

  public getTargetRepoOwner(): string | undefined {
    const repoUrl = this.getTargetRepoUrl();
    if (!repoUrl) return;
    const owner = repoUrl.split("/")[3];
    if (!owner) throw new Error("Unable to get repo owner");
    return owner;
  }

  public getTargetRepoName(): string | undefined {
    const repoUrl = this.getTargetRepoUrl();
    if (!repoUrl) return;
    const repoName = repoUrl.split("/").pop();
    if (!repoName) throw new Error("Unable to get repo name");
    return repoName;
  }

  private getTargetTeamUrl(): string | undefined {
    return this.getYamlHeader().team as string;
  }

  public getTargetTeamOwner(): string | undefined {
    const teamUrl = this.getTargetTeamUrl();
    if (!teamUrl) return;
    const owner = teamUrl.split("/")[4];
    if (!owner) throw new Error("Unable to get team owner");
    return owner;
  }

  public getTargetTeamName(): string | undefined {
    const teamUrl = this.getTargetTeamUrl();
    if (!teamUrl) return;
    const teamName = teamUrl.split("/").pop();
    if (!teamName) throw new Error("Unable to get team name");
    return teamName;
  }

  public getDiscussionCategoryName(): string | undefined {
    const repoUrl = this.getTargetRepoUrl();
    if (!repoUrl) return;
    const rawCat = this.getYamlHeader().category as string;
    const categoryName = rawCat?.split("/").pop()?.trim();
    if (!categoryName) throw new Error("Unable to get discussion category");
    return categoryName;
  }

  public getLabels(): string[] {
    const rawLabels = this.getYamlHeader().labels;
    if (!rawLabels) return [];
    // Support both array format (YAML list) and comma-separated string
    if (Array.isArray(rawLabels)) {
      return rawLabels.map((label) => String(label).trim()).filter((label) => label.length > 0);
    }
    if (typeof rawLabels === "string") {
      return rawLabels
        .split(",")
        .map((label) => label.trim())
        .filter((label) => label.length > 0);
    }
    return [];
  }

  public getPostTitle(): string {
    if (!this._content.includes("# ")) throw new Error("You must include a top level header # in your markdown that has the post title");
    const postTitle = this._content.split("# ")[1].split("\n")[0].trim();
    return postTitle;
  }

  public getPostBody(): string {
    const postTitle = this.getPostTitle();
    const startIndex = this._content.indexOf(postTitle) + postTitle.length;
    const postBody = this._content.substring(startIndex).trim();
    return postBody;
  }

  public getFileLines(): string[] {
    if (!this._fileLines) this._fileLines = this._content.split(/\r\n|\r|\n/);
    return this._fileLines;
  }

  public getHeaderEndLine(): number {
    const index = this.getFileLines().findIndex((line) => line.includes("-->"));
    if (index === -1) return 1;
    return index + 1;
  }

  public parseDocument(): ParsedMarkdownDiscussion {
    return {
      repo: this.getTargetRepoName(),
      repoOwner: this.getTargetRepoOwner(),
      team: this.getTargetTeamName(),
      teamOwner: this.getTargetTeamOwner(),
      discussionCategoryName: this.getDiscussionCategoryName(),
      labels: this.getLabels(),
      postBody: this.getPostBody(),
      postTitle: this.getPostTitle(),
      headerEndLine: this.getHeaderEndLine(),
    };
  }
}
