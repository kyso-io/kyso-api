import { forwardRef, Inject, Injectable, OnModuleInit, Scope } from '@nestjs/common'
import { NotFoundError } from 'src/helpers/errorHandling'
import { QueryParser } from 'src/helpers/queryParser'
import { GithubReposProvider } from 'src/modules/github-repos/providers/github-repo.provider'
import { ReportsService } from '../reports/reports.service'
const { safeLoad } = require('js-yaml')

const DEFAULT_REPOS_PER_PAGE = 30
const KYSO_FILE_REGEX = '[.]?kyso[.](json|yaml)'
const formatters = {
    json: JSON.parse,
    yaml: safeLoad,
}

function parseConfig(format, data) {
    let config = {}
    if (formatters[format]) {
        config = formatters[format](data)
    }

    return config
}

@Injectable({ scope: Scope.REQUEST })
export class GithubReposService {
    constructor(
        private readonly provider: GithubReposProvider,
        @Inject(forwardRef(() => ReportsService))
        private readonly reportsService: ReportsService,
    ) {}

    login(access_token) {
        this.provider.login(access_token)
    }

    async getBranches(repoOwner, repoName) {
        const branches = await this.provider.getBranches(repoOwner, repoName)

        return branches
    }

    async getCommits(repoOwner, repoName, branch) {
        const commits = await this.provider.getCommits(repoOwner, repoName, branch)

        return commits
    }

    _assignReports(user) {
        return async (repo) => {
            const reports = await this.reportsService.getReports({
                filter: {
                    'provider.owner': repo.owner,
                    'provider.name': repo.name.toLowerCase(),
                    _p_user: QueryParser.createForeignKey('_User', user.objectId),
                },
            })

            if (reports.length) repo.report = reports[0].full_name
        }
    }

    async getRepos({ user, filter, page = 1, perPage = DEFAULT_REPOS_PER_PAGE }) {
        const repos = filter ? await this.provider.searchRepos(filter, page, perPage) : await this.provider.getRepos(page, perPage)

        await Promise.all(repos.map(this._assignReports(user)))

        return repos
    }

    async getRepo(user, owner, name) {
        const repo = await this.provider.getRepo(owner, name)
        if (!repo)
            throw new NotFoundError({
                message: "The specified repository couldn't be found",
            })
        await this._assignReports(user)(repo)

        return repo
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
        const tree = await this.provider.getFileHash('.', owner, repo, branch)
        return tree.filter((file) => file.type === 'dir')
    }

    async getFileHash(filePath, owner, repo, branch) {
        const hash = await this.provider.getFileHash(filePath, owner, repo, branch)
        return hash
    }

    async getFileContent(hash, owner, repo) {
        const content = await this.provider.getFileContent(hash, owner, repo)
        return content
    }

    async getConfigFile(path, owner, repo, branch) {
        let regexPath = path.replace(/^\//, '').replace(/\/$/, '').replace(/\//, '\\/')
        regexPath = regexPath.length ? `${regexPath}/` : ''
        const regex = new RegExp(`^${regexPath}${KYSO_FILE_REGEX}$`)

        const files = await this.getFileHash(path, owner, repo, branch)
        const kysoFile = files.find((file) => file.path.match(regex))
        if (!kysoFile) return {}

        const data = await this.getFileContent(kysoFile.hash, owner, repo)
        const format = kysoFile.path.split('.').pop()
        const config = parseConfig(format, data)

        return config
    }
}
