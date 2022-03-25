import { GithubBranch, GithubCommit, GithubFileHash, GithubRepository, KysoConfigFile } from '@kyso-io/kyso-model'
import { Injectable, Provider } from '@nestjs/common'
import { AutowiredService } from '../../generic/autowired.generic'
import { GitlabAccessToken } from './interfaces/gitlab-access-token'
import { GitlabBranch } from './interfaces/gitlab-branch'
import { GitlabCommit } from './interfaces/gitlab-commit'
import { GitlabFile } from './interfaces/gitlab-file'
import { GitlabRepository } from './interfaces/gitlab-repository'
import { GitlabUser } from './interfaces/gitlab-user'
import { GitlabUserEmail } from './interfaces/gitlab-user-email'
import { GitlabReposProvider } from './providers/gitlab-repos.provider'

function factory(service: GitlabReposService) {
    return service
}

export function createProvider(): Provider<GitlabReposService> {
    return {
        provide: `${GitlabReposService.name}`,
        useFactory: (service) => factory(service),
        inject: [GitlabReposService],
    }
}

const gitlabRepositoryToGithubRepository = (repository: GitlabRepository): GithubRepository => ({
    id: repository.id,
    owner: repository?.owner ? repository.owner.username : '',
    name: repository.name,
    fullName: repository.name_with_namespace,
    defaultBranch: repository.default_branch,
    description: repository.description,
    isPrivate: repository.visibility === 'private',
    language: null,
    pushedAt: repository.last_activity_at,
})

@Injectable()
export class GitlabReposService extends AutowiredService {
    constructor(private provider: GitlabReposProvider) {
        super()
    }

    public async getAccessToken(code: string): Promise<GitlabAccessToken> {
        return this.provider.getAccessToken(code)
    }

    public async refreshAccessToken(refreshToken: string): Promise<GitlabAccessToken> {
        return this.provider.refreshAccessToken(refreshToken)
    }

    public async getUser(accessToken: string): Promise<GitlabUser> {
        return this.provider.getUser(accessToken)
    }

    public async getRepositories(accessToken: string, page: number, per_page: number, search?: string): Promise<GithubRepository[]> {
        const repositories: GitlabRepository[] = await this.provider.getRepositories(accessToken, page, per_page, search)
        return repositories.map((repository: GitlabRepository) => gitlabRepositoryToGithubRepository(repository))
    }

    public async getUserRepositories(accessToken: string, userId: number, page: number, per_page: number, search?: string): Promise<GithubRepository[]> {
        const repositories: GitlabRepository[] = await this.provider.getUserRepositories(accessToken, userId, page, per_page, search)
        return repositories.map((repository: GitlabRepository) => gitlabRepositoryToGithubRepository(repository))
    }

    public async getRepository(accessToken: string, repositoryId: number): Promise<GithubRepository> {
        const repository: GitlabRepository = await this.provider.getRepository(accessToken, repositoryId)
        return gitlabRepositoryToGithubRepository(repository)
    }

    public async getRepositoryTree(accessToken: string, repositoryId: number, branch: string, path: string, recursive: boolean): Promise<GithubFileHash[]> {
        const tree: GitlabFile[] = await this.provider.getRepositoryTree(accessToken, repositoryId, branch, path, recursive)
        return tree.map((file: GitlabFile) => ({
            type: null,
            path: file.path,
            hash: file.id,
            htmlUrl: null,
            path_scs: null,
            version: null,
        }))
    }

    public async getBranches(accessToken: string, repositoryId: number): Promise<GithubBranch[]> {
        const branches: GitlabBranch[] = await this.provider.getBranches(accessToken, repositoryId)
        return branches.map((branch: GitlabBranch) => ({
            name: branch.name,
            commit: branch.commit.id,
        }))
    }

    public async getCommits(accessToken: string, repositoryId: number, branch: string): Promise<GithubCommit[]> {
        const commits: GitlabCommit[] = await this.provider.getCommits(accessToken, repositoryId, branch)
        return commits.map((commit: GitlabCommit) => ({
            sha: commit.id,
            author: {
                name: commit.author_name,
                email: commit.author_email,
            },
            date: commit.created_at,
            message: commit.message,
            htmlUrl: commit.web_url,
        }))
    }

    public async getUserByAccessToken(accessToken: string): Promise<GitlabUser> {
        return this.provider.getUserByAccessToken(accessToken)
    }

    public async getUserEmails(accessToken: string): Promise<GitlabUserEmail[]> {
        return this.provider.getUserEmails(accessToken)
    }

    public async getFileContent(accessToken: string, repositoryId: number, path: string, commit: string): Promise<Buffer> {
        return this.provider.getFileContent(accessToken, repositoryId, path, commit)
    }

    public async getConfigFile(accessToken: string, repositoryId: number, commit: string): Promise<KysoConfigFile> {
        return this.provider.getConfigFile(accessToken, repositoryId, commit)
    }

    public async downloadRepository(accessToken: string, repositoryId: string, commit: string): Promise<Buffer> {
        return this.provider.downloadRepository(accessToken, repositoryId, commit)
    }
}
