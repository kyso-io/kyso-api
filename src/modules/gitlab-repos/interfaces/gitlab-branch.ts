import { GitlabCommit } from './gitlab-commit';

export interface GitlabBranch {
  name: string;
  commit: GitlabCommit;
  merged: boolean;
  protected: boolean;
  developers_can_push: boolean;
  developers_can_merge: boolean;
  can_push: boolean;
  default: boolean;
  web_url: string;
}
