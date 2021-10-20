export interface Content {
  status: number;
  url: string;
  headers: Headers;
  data: Data;
}
export interface Headers {
  'access-control-allow-origin': string;
  'access-control-expose-headers': string;
  'cache-control': string;
  connection: string;
  'content-encoding': string;
  'content-security-policy': string;
  'content-type': string;
  date: string;
  etag: string;
  'last-modified': string;
  'referrer-policy': string;
  server: string;
  'strict-transport-security': string;
  'transfer-encoding': string;
  vary: string;
  'x-content-type-options': string;
  'x-frame-options': string;
  'x-github-media-type': string;
  'x-github-request-id': string;
  'x-ratelimit-limit': string;
  'x-ratelimit-remaining': string;
  'x-ratelimit-reset': string;
  'x-ratelimit-resource': string;
  'x-ratelimit-used': string;
  'x-xss-protection': string;
}
export interface Data {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: string;
  content: string;
  encoding: string;
  _links: Links;
}
export interface Links {
  self: string;
  git: string;
  html: string;
}
