import { GithubAccount, GithubBranch, GithubCommit, GithubEmail, GithubFileHash, GithubRepository, KysoConfigFile } from '@kyso-io/kyso-model'
import { Injectable, Provider } from '@nestjs/common'
import { AutowiredService } from '../../generic/autowired.generic'
import { NotFoundError } from '../../helpers/errorHandling'
import { GithubReposProvider } from './providers/github-repo.provider'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { safeLoad } = require('js-yaml')

const DEFAULT_REPOS_PER_PAGE = 30
const KYSO_FILE_REGEX = '[.]?kyso[.](json|yaml)'
const formatters = {
    json: JSON.parse,
    yaml: safeLoad,
}

function parseConfig(format, data): KysoConfigFile {
    let config = {}
    if (formatters[format]) {
        config = formatters[format](data)
    }
    return config as KysoConfigFile
}

function factory(service: GithubReposService) {
    return service
}

export function createProvider(): Provider<GithubReposService> {
    return {
        provide: `${GithubReposService.name}`,
        useFactory: (service) => factory(service),
        inject: [GithubReposService],
    }
}

// @Injectable({ scope: Scope.REQUEST })
@Injectable()
export class GithubReposService extends AutowiredService {
    constructor(private readonly provider: GithubReposProvider) {
        super()
    }

    public login(access_token: string): void {
        this.provider.login(access_token)
    }

    async getBranches(githubUsername: string, repositoryName: string): Promise<GithubBranch[]> {
        return this.provider.getBranches(githubUsername, repositoryName)
    }

    public async getCommits(githubUsername: string, repositoryName: string, branch: string): Promise<GithubCommit[]> {
        return this.provider.getCommits(githubUsername, repositoryName, branch)
    }

    public async getRepos({ filter, page = 1, perPage = DEFAULT_REPOS_PER_PAGE }) {
        return filter ? this.provider.searchRepos(filter, page, perPage) : this.provider.getRepos(page, perPage)
    }

    public async getGithubRepository(githubUsername: string, repositoryName: string): Promise<GithubRepository> {
        const githubRepository: GithubRepository = await this.provider.getRepository(githubUsername, repositoryName)
        if (!githubRepository) {
            throw new NotFoundError({
                message: "The specified repository couldn't be found",
            })
        }
        return githubRepository
    }

    public async getUserByAccessToken(access_token: string): Promise<any> {
        return this.provider.getUserByAccessToken(access_token)
    }

    public async getEmailsByAccessToken(access_token: string): Promise<GithubEmail[]> {
        return this.provider.getEmailsByAccessToken(access_token)
    }

    public async getUser(): Promise<GithubAccount> {
        const [user, orgs] = await Promise.all([this.provider.getUser(), this.provider.getOrganizations()])
        return {
            id: user.id,
            login: user.login,
            orgs: orgs.map((org) => ({
                id: org.id,
                login: org.login,
            })),
        }
    }

    public async getRepoTree(owner: string, repo: string, branch: string): Promise<GithubFileHash[]> {
        const tree: GithubFileHash | GithubFileHash[] = await this.provider.getFileHash('.', owner, repo, branch)
        return Array.isArray(tree) ? tree.filter((file) => file.type === 'dir') : []
    }

    public async getFileHash(path: string, githubUsername: string, repositoryName: string, branch: string): Promise<GithubFileHash | GithubFileHash[]> {
        return this.provider.getFileHash(path, githubUsername, repositoryName, branch)
    }

    public async getFileContent(hash: string, githubUsername: string, repositoryName: string): Promise<Buffer> {
        return this.provider.getFileContent(hash, githubUsername, repositoryName)
    }

    public async getConfigFile(path: string, githubUsername: string, repositoryName: string, branch: string): Promise<KysoConfigFile> {
        let regexPath = path.replace(/^\//, '').replace(/\/$/, '').replace(/\//, '\\/')
        regexPath = regexPath.length ? `${regexPath}/` : ''
        const regex = new RegExp(`^${regexPath}${KYSO_FILE_REGEX}$`)
        const files: GithubFileHash[] = (await this.getFileHash(path, githubUsername, repositoryName, branch)) as GithubFileHash[]
        const kysoFile: GithubFileHash = files.find((file: GithubFileHash) => file.path.match(regex))
        if (!kysoFile) {
            return null
        }
        const format: string = kysoFile.path.split('.').pop()
        const data: Buffer = await this.getFileContent(kysoFile.hash, githubUsername, repositoryName)
        return parseConfig(format, data)
    }
}
