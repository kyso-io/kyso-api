import { GithubBranch, GithubCommit, GithubFileHash, GithubRepository, KysoConfigFile } from '@kyso-io/kyso-model'
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

    login(access_token) {
        this.provider.login(access_token)
    }

    async getBranches(githubUsername: string, repositoryName: string): Promise<GithubBranch[]> {
        return this.provider.getBranches(githubUsername, repositoryName)
    }

    async getCommits(githubUsername: string, repositoryName: string, branch: string): Promise<GithubCommit[]> {
        return this.provider.getCommits(githubUsername, repositoryName, branch)
    }

    /*
    _assignReports(user) {
        return async (repo) => {
            const reports = await this.reportsService.getReports({
                filter: {
                    'provider.owner': repo.owner,
                    'provider.name': repo.name.toLowerCase(),
                    user_id: QueryParser.createForeignKey('_User', user.objectId),
                },
            })

            if (reports.length) repo.report = reports[0].full_name
        }
    }*/

    async getRepos({ user, filter, page = 1, perPage = DEFAULT_REPOS_PER_PAGE }) {
        const repos = filter ? await this.provider.searchRepos(filter, page, perPage) : await this.provider.getRepos(page, perPage)

        // await Promise.all(repos.map(this._assignReports(user)))

        return repos
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

    async getUserByAccessToken(access_token: string) {
        return this.provider.getUserByAccessToken(access_token)
    }

    async getEmailByAccessToken(access_token: string) {
        return this.provider.getEmailByAccessToken(access_token)
    }

    async getUser() {
        const [user, orgs] = await Promise.all([this.provider.getUser(), this.provider.getOrganizations()])
        const result = {
            id: user.id,
            login: user.login,
            orgs: orgs.map((org) => ({
                id: org.id,
                login: org.login,
            })),
        }

        return result
    }

    async getRepoTree(owner, repo, branch) {
        const tree: GithubFileHash | GithubFileHash[] = await this.provider.getFileHash('.', owner, repo, branch)
        return Array.isArray(tree) ? tree.filter((file) => file.type === 'dir') : []
    }

    async getFileHash(path: string, githubUsername: string, repositoryName: string, branch: string): Promise<GithubFileHash | GithubFileHash[]> {
        return this.provider.getFileHash(path, githubUsername, repositoryName, branch)
    }

    async getFileContent(hash: string, githubUsername: string, repositoryName: string): Promise<Buffer> {
        return this.provider.getFileContent(hash, githubUsername, repositoryName)
    }

    async getConfigFile(path: string, githubUsername: string, repositoryName: string, branch: string): Promise<KysoConfigFile> {
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
