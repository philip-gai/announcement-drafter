export interface PullRequestComment {
  url: string;
  pull_request_review_id: number | null;
  id: number;
  node_id: string;
  diff_hunk: string;
  path: string;
  position: number;
  original_position: number;
  commit_id: string;
  original_commit_id: string;
  in_reply_to_id?: number | undefined;
  user: {
    name?: string | null | undefined;
    email?: string | null | undefined;
    login: string;
    id: number;
    node_id: string;
    avatar_url: string;
    gravatar_id: string | null;
    url: string;
    html_url: string;
    followers_url: string;
    following_url: string;
    gists_url: string;
    starred_url: string;
    subscriptions_url: string;
    organizations_url: string;
    repos_url: string;
    events_url: string;
    received_events_url: string;
    type: string;
    site_admin: boolean;
    starred_at?: string | undefined;
  };
  body: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  pull_request_url: string;
  author_association: "COLLABORATOR" | "CONTRIBUTOR" | "FIRST_TIMER" | "FIRST_TIME_CONTRIBUTOR" | "MANNEQUIN" | "MEMBER" | "NONE" | "OWNER";
  _links: { self: { href: string }; html: { href: string }; pull_request: { href: string } };
  start_line?: number | null | undefined;
  original_start_line?: number | null | undefined;
  start_side?: "LEFT" | "RIGHT" | null | undefined;
  line?: number | undefined;
  original_line?: number | undefined;
  side?: "LEFT" | "RIGHT" | undefined;
  reactions?:
    | {
        url: string;
        total_count: number;
        "+1": number;
        "-1": number;
        laugh: number;
        confused: number;
        heart: number;
        hooray: number;
        eyes: number;
        rocket: number;
      }
    | undefined;
  body_html?: string | undefined;
  body_text?: string | undefined;
}

export interface PullRequestCommentReaction {
  id: number;
  node_id: string;
  user: {
    name?: string | null | undefined;
    email?: string | null | undefined;
    login: string;
    id: number;
    node_id: string;
    avatar_url: string;
    gravatar_id: string | null;
    url: string;
    html_url: string;
    followers_url: string;
    following_url: string;
    gists_url: string;
    starred_url: string;
    subscriptions_url: string;
    organizations_url: string;
    repos_url: string;
    events_url: string;
    received_events_url: string;
    type: string;
    site_admin: boolean;
    starred_at?: string | undefined;
  } | null;
  content: "+1" | "-1" | "laugh" | "confused" | "heart" | "hooray" | "rocket" | "eyes";
  created_at: string;
}

export interface TeamDiscussion {
  author: {
    name?: string | null | undefined;
    email?: string | null | undefined;
    login: string;
    id: number;
    node_id: string;
    avatar_url: string;
    gravatar_id: string | null;
    url: string;
    html_url: string;
    followers_url: string;
    following_url: string;
    gists_url: string;
    starred_url: string;
    subscriptions_url: string;
    organizations_url: string;
    repos_url: string;
    events_url: string;
    received_events_url: string;
    type: string;
    site_admin: boolean;
    starred_at?: string | undefined;
  } | null;
  body: string;
  body_html: string;
  body_version: string;
  comments_count: number;
  comments_url: string;
  created_at: string;
  last_edited_at: string | null;
  html_url: string;
  node_id: string;
  number: number;
  pinned: boolean;
  private: boolean;
  team_url: string;
  title: string;
  updated_at: string;
  url: string;
  reactions?:
    | {
        url: string;
        total_count: number;
        "+1": number;
        "-1": number;
        laugh: number;
        confused: number;
        heart: number;
        hooray: number;
        eyes: number;
        rocket: number;
      }
    | undefined;
}
