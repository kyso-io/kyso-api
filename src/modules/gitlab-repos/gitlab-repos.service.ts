import { GithubBranch, GithubCommit, GithubFileHash, GithubRepository, KysoConfigFile, UserAccount } from '@kyso-io/kyso-model';
import { Injectable, Logger, Provider } from '@nestjs/common';
import * as moment from 'moment';
import { AutowiredService } from '../../generic/autowired.generic';
import { GitlabAccessToken } from './interfaces/gitlab-access-token';
import { GitlabBranch } from './interfaces/gitlab-branch';
import { GitlabCommit } from './interfaces/gitlab-commit';
import { GitlabFile } from './interfaces/gitlab-file';
import { GitlabRepository } from './interfaces/gitlab-repository';
import { GitlabUser } from './interfaces/gitlab-user';
import { GitlabUserEmail } from './interfaces/gitlab-user-email';
import { GitlabWeebHook } from './interfaces/gitlab-webhook';
import { GitlabReposProvider } from './providers/gitlab-repos.provider';

function factory(service: GitlabReposService) {
  return service;
}

export function createProvider(): Provider<GitlabReposService> {
  return {
    provide: `${GitlabReposService.name}`,
    useFactory: (service) => factory(service),
    inject: [GitlabReposService],
  };
}

const gitlabRepositoryToGithubRepository = (repository: GitlabRepository): GithubRepository => ({
  id: repository.id, // repository.path_with_namespace
  owner: repository?.owner ? repository.owner.username : '',
  name: repository.name,
  fullName: repository.name_with_namespace,
  defaultBranch: repository.default_branch,
  description: repository.description,
  isPrivate: repository.visibility === 'private',
  language: null,
  pushedAt: repository.last_activity_at,
});

@Injectable()
export class GitlabReposService extends AutowiredService {
  constructor(private provider: GitlabReposProvider) {
    super();
  }

  public async getAccessToken(code: string, redirectUri?: string): Promise<GitlabAccessToken> {
    return this.provider.getAccessToken(code, redirectUri);
  }

  public async refreshAccessToken(refreshToken: string): Promise<GitlabAccessToken> {
    return this.provider.refreshAccessToken(refreshToken);
  }

  public checkAccessTokenValidity(userAccount: UserAccount): Promise<GitlabAccessToken> {
    if (moment().isAfter(moment((userAccount.payload.created_at + userAccount.payload.expires_in) * 1000))) {
      Logger.log(`Gitlab access token is expired for user ${userAccount.username}. Refreshing token...`, 'GitlabReposService');
      return this.refreshAccessToken(userAccount.payload.refresh_token);
    }
    return userAccount.payload;
  }

  public async getUser(accessToken: string): Promise<GitlabUser> {
    return this.provider.getUser(accessToken);
  }

  public async getRepositories(accessToken: string, page: number, per_page: number, search?: string): Promise<GithubRepository[]> {
    const repositories: GitlabRepository[] = await this.provider.getRepositories(accessToken, page, per_page, search);
    return repositories.map((repository: GitlabRepository) => gitlabRepositoryToGithubRepository(repository));
  }

  public async getUserRepositories(accessToken: string, userId: number, page: number, per_page: number, search?: string): Promise<GithubRepository[]> {
    const repositories: GitlabRepository[] = await this.provider.getUserRepositories(accessToken, userId, page, per_page, search);
    return repositories.map((repository: GitlabRepository) => gitlabRepositoryToGithubRepository(repository));
  }

  public async getRepository(accessToken: string, repositoryId: number | string): Promise<GithubRepository> {
    const repository: GitlabRepository = await this.provider.getRepository(accessToken, repositoryId);
    return gitlabRepositoryToGithubRepository(repository);
  }

  public async getRepositoryTree(accessToken: string, repositoryId: number, branch: string, path: string, recursive: boolean): Promise<GithubFileHash[]> {
    const tree: GitlabFile[] = await this.provider.getRepositoryTree(accessToken, repositoryId, branch, path, recursive);
    return tree.map((file: GitlabFile) => new GithubFileHash(file.id, file.type === 'tree' ? 'dir' : 'file', file.path, file.id, null, null, null));
  }

  public async getBranches(accessToken: string, repositoryId: number): Promise<GithubBranch[]> {
    const branches: GitlabBranch[] = await this.provider.getBranches(accessToken, repositoryId);
    return branches.map((branch: GitlabBranch) => new GithubBranch(branch.name, branch.commit.id));
  }

  public async getCommits(accessToken: string, repositoryId: number, branch: string): Promise<GithubCommit[]> {
    const commits: GitlabCommit[] = await this.provider.getCommits(accessToken, repositoryId, branch);
    return commits.map((commit: GitlabCommit) => new GithubCommit(commit.id, { name: commit.author_name, email: commit.author_email }, commit.created_at, commit.message, commit.web_url));
  }

  public async getUserByAccessToken(accessToken: string): Promise<GitlabUser> {
    return this.provider.getUserByAccessToken(accessToken);
  }

  public async getUserEmails(accessToken: string): Promise<GitlabUserEmail[]> {
    return this.provider.getUserEmails(accessToken);
  }

  public async getFileContent(accessToken: string, repositoryId: number, path: string, commit: string): Promise<Buffer> {
    return this.provider.getFileContent(accessToken, repositoryId, path, commit);
  }

  public async getConfigFile(accessToken: string, repositoryId: number, commit: string): Promise<KysoConfigFile> {
    return this.provider.getConfigFile(accessToken, repositoryId, commit);
  }

  public async downloadRepository(accessToken: string, repositoryId: number | string, commit: string): Promise<Buffer> {
    return this.provider.downloadRepository(accessToken, repositoryId, commit);
  }

  public async createWebhookGivenRepository(accessToken: string, repositoryId: number | string, webhookUrl: string): Promise<GitlabWeebHook> {
    return this.provider.createWebhookGivenRepository(accessToken, repositoryId, webhookUrl);
  }
}
