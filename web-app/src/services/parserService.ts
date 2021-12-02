import { DeprecatedLogger } from 'probot/lib/types';
import YAML from 'yaml';

export interface ParsedMarkdownDiscussion {
  repo: string | undefined;
  repoOwner: string | undefined;
  team: string | undefined;
  teamOwner: string | undefined;
  discussionCategoryName: string | undefined;
  postBody: string;
  postTitle: string;
  author: string;
}

export class ParserService {
  private _content: string;
  private _yamlHeader: any;
  private _logger: DeprecatedLogger;

  private constructor(fileContent: string, logger: DeprecatedLogger) {
    this._content = fileContent;
    this._logger = logger;
    this._yamlHeader = this.parseYamlHeader(fileContent);
  }

  static build(fileContent: string, logger: DeprecatedLogger): ParserService {
    return new ParserService(fileContent, logger);
  }

  // https://www.npmjs.com/package/yaml
  private parseYamlHeader(content: string): any {
    try {
      this._logger.info('Parsing YAML from the markdown comment header...');
      const startIndex = content.indexOf('<!--') + '<!--'.length;
      const endIndex = content.indexOf('-->');
      const yamlStr = content.substring(startIndex, endIndex);
      this._logger.debug(yamlStr);
      const yaml = YAML.parse(yamlStr);
      return yaml;
    } catch (err) {
      throw new Error('The YAML provided was invalid.');
    }
  }

  public getPostAuthor(): string {
    return this._yamlHeader.author?.replace('@', '') as string;
  }

  private getTargetRepoUrl(): string | undefined {
    return (this._yamlHeader.repo as string) || (this._yamlHeader.repository as string);
  }

  public getTargetRepoOwner(): string | undefined {
    const repoUrl = this.getTargetRepoUrl();
    if (!repoUrl) return;
    const owner = repoUrl.split('/')[3];
    if (!owner) throw new Error('Unable to get repo owner');
    return owner;
  }

  public getTargetRepoName(): string | undefined {
    const repoUrl = this.getTargetRepoUrl();
    if (!repoUrl) return;
    const repoName = repoUrl.split('/').pop();
    if (!repoName) throw new Error('Unable to get repo name');
    return repoName;
  }

  private getTargetTeamUrl(): string | undefined {
    return this._yamlHeader.team as string;
  }

  public getTargetTeamOwner(): string | undefined {
    const teamUrl = this.getTargetTeamUrl();
    if (!teamUrl) return;
    const owner = teamUrl.split('/')[4];
    if (!owner) throw new Error('Unable to get team owner');
    return owner;
  }

  public getTargetTeamName(): string | undefined {
    const teamUrl = this.getTargetTeamUrl();
    if (!teamUrl) return;
    const teamName = teamUrl.split('/').pop();
    if (!teamName) throw new Error('Unable to get team name');
    return teamName;
  }

  public getDiscussionCategoryName(): string | undefined {
    const repoUrl = this.getTargetRepoUrl();
    if (!repoUrl) return;
    const rawCat = this._yamlHeader.category as string;
    const categoryName = rawCat?.split('/').pop()?.trim();
    if (!categoryName) throw new Error('Unable to get discussion category');
    return categoryName;
  }

  public getPostTitle(): string {
    if (!this._content.includes('# ')) throw new Error('You must include a top level header # in your markdown that has the post title');
    const postTitle = this._content.split('# ')[1].split('\n')[0].trim();
    return postTitle;
  }

  public getPostBody(): string {
    const postTitle = this.getPostTitle();
    const startIndex = this._content.indexOf(postTitle) + postTitle.length;
    const postBody = this._content.substring(startIndex).trim();
    return postBody;
  }

  public parseDocument(): ParsedMarkdownDiscussion {
    return {
      repo: this.getTargetRepoName(),
      repoOwner: this.getTargetRepoOwner(),
      team: this.getTargetTeamName(),
      teamOwner: this.getTargetTeamOwner(),
      discussionCategoryName: this.getDiscussionCategoryName(),
      postBody: this.getPostBody(),
      postTitle: this.getPostTitle(),
      author: this.getPostAuthor()
    };
  }
}
