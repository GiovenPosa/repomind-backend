export interface GithubRepositoryRef {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description?: string | null;
  default_branch: string;
  owner: {
    login: string;
    id: number;
  };
}

export interface GithubPushCommit {
  id: string;               // commit SHA
  message: string;
  timestamp: string;
  url: string;
  author: { name: string; email?: string; username?: string };
  added?: string[];
  removed?: string[];
  modified?: string[];
}

export interface GithubPushPayload {
  ref: string;
  before: string;
  after: string;
  repository: GithubRepositoryRef;
  pusher: { name: string; email?: string };
  sender: { login: string; id: number };
  head_commit?: GithubPushCommit;
  commits?: GithubPushCommit[];
  installation?: { id: number }; // for GitHub Apps
}

export type RepositoryAction =
  | 'created' | 'deleted' | 'archived' | 'unarchived'
  | 'renamed' | 'transferred' | 'publicized' | 'privatized';

export interface GithubRepositoryEvent {
  action: RepositoryAction;
  repository: GithubRepositoryRef;
  sender: { login: string; id: number };
}

export interface IncludeExclude {
  include: string[];
  exclude: string[];
  maxFileKB: number;
}

// Git tree/blob responses (Octokit REST API)
export interface GitTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number; // only for blobs
  url: string;
}

export interface GitTreeResponse {
  sha: string;
  url: string;
  tree: GitTreeItem[];
  truncated?: boolean;
}