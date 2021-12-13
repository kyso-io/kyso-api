import { forwardRef, Inject, Injectable } from '@nestjs/common'
import { AlreadyExistsError, ForbiddenError, InvalidInputError, NotFoundError } from 'src/helpers/errorHandling'
import { QueryParser } from 'src/helpers/queryParser'
import { Validators } from 'src/helpers/validators'
import { ReportsMongoProvider } from 'src/modules/reports/providers/mongo-reports.provider'
import { GithubReposService } from '../github-repos/github-repos.service'
import { TeamsService } from '../teams/teams.service'
import { UsersService } from '../users/users.service'
import { LocalReportsService } from './local-reports.service'

const CREATE_REPORT_FIELDS = ['main', 'title', 'description', 'preview', 'tags', 'authors']
const LOCAL_REPORT_HOST = 's3'

function generateReportName(repoName, path) {
    const pathName = path.replace(/\//g, '_')
    return repoName + (pathName ? '_' : '') + pathName
}

@Injectable()
export class ReportsService {
    constructor(
        private readonly provider: ReportsMongoProvider,
        @Inject(forwardRef(() => GithubReposService))
        private readonly githubReposService: GithubReposService,
        private readonly teamsService: TeamsService,
        private readonly usersService: UsersService,
        private readonly localReportsService: LocalReportsService,
    ) {}

    async getReports(query) {
        if (query.filter && query.filter.owner) {
            const results = await Promise.allSettled([
                this.usersService.getUser({
                    filter: { nickname: query.filter.owner },
                }),
                this.teamsService.getTeam({
                    filter: { name: query.filter.owner },
                }),
            ])

            delete query.filter.owner
            if (results[0].status === 'fulfilled') {
                query.filter._p_user = QueryParser.createForeignKey('_User', results[0].value.id)
            } else if (results[1].status === 'fulfilled') {
                query.filter._p_team = QueryParser.createForeignKey('Team', results[1].value.id)
            } else {
                return []
            }
        }

        if (query.filter && query.filter.hasOwnProperty('pinned')) {
            if (query.filter.pinned === false) {
                // If a report has no pin property, we count it as pin=false
                query.filter.pin = { $ne: 'true' }
            } else {
                query.filter.pin = true
            }

            delete query.filter.pinned
        }

        const reports = await this.provider.getReportsWithOwner(query)
        return reports
    }

    async getReport(reportOwner, reportName) {
        const reports = await this.getReports({
            filter: {
                owner: reportOwner,
                name: reportName,
            },
            limit: 1,
        })

        if (reports.length === 0)
            throw new NotFoundError({
                message: "The specified report couldn't be found",
            })
        return reports[0]
    }

    async createReport(user, data, teamName) {
        if (!Validators.isValidReportName(data.src.name))
            throw new InvalidInputError({
                message: `Study name can only consist of letters, numbers, '_' and '-'.`,
            })

        const basePath = (data.src.path || '').replace(/^[.]\//, '')
        const reportName = generateReportName(data.src.name, basePath)

        // OLD line... what is he doing with the result of this???
        // await this.reposService({ provider: data.src.provider, accessToken: user.accessToken }).getRepo(user, data.src.owner, data.src.name)

        // NEW
        switch (data.src.provider) {
            case 'github':
            default:
                this.githubReposService.login(user.accessToken)
                await this.githubReposService.getRepo(user, data.src.owner, data.src.name)
                break
        }
        // END NEW

        let report = {
            _p_user: QueryParser.createForeignKey('_User', user.objectId),
        } as any
        const usedNameQuery = {
            filter: {
                name: reportName,
                limit: 1,
            },
        } as any

        if (teamName) {
            const { id: teamId } = await this.teamsService.getTeam({
                filter: { name: teamName },
            })
                        
            report._p_team = QueryParser.createForeignKey('Team', teamId)
            usedNameQuery.filter._p_team = report._p_team
        } else usedNameQuery.filter._p_user = report._p_user

        const reports = await this.provider.read(usedNameQuery)
        if (reports.length !== 0)
            throw new AlreadyExistsError({
                message: 'The specified name is already used by another report',
            })

        let metadata = {}
        try {
            // OLD LINE
            // metadata = await this.reposService({ provider: data.src.provider, accessToken: user.accessToken }).getConfigFile(basePath, data.src.owner, data.src.name, data.src.default_branch)
            switch (data.src.provider) {
                case 'github':
                default:
                    this.githubReposService.login(user.accessToken)
                    metadata = this.githubReposService.getConfigFile(basePath, data.src.owner, data.src.name, data.src.default_branch)
                    break
            }
        } catch (err) {}

        CREATE_REPORT_FIELDS.forEach((key) => {
            if (metadata[key]) report[key] = metadata[key]
        })
        report = {
            ...report,
            name: reportName,
            provider: {
                source: data.src.provider,
                owner: data.src.owner,
                name: data.src.name,
                defaultBranch: data.src.default_branch,
                basePath,
            },
            numberOfComments: 0,
            stars: 0,
            views: 0,
        }

        return this.provider.create(report)
    }

    async updateReport(userId, reportOwner, reportName, data) {
        const report = await this.getReport(reportOwner, reportName)

        return this.provider.update({ _id: report.id }, data)
    }

    async deleteReport(userId, reportOwner, reportName) {
        const report = await this.getReport(reportOwner, reportName)

        await this.provider.delete({ _id: this.provider.parseId(report.id) })
    }

    async pinReport(userId, reportOwner, reportName) {
        const report = await this.getReport(reportOwner, reportName)

        const existingReports = await this.getReports({
            filter: {
                owner: reportOwner,
                pin: true,
            },
            limit: 1,
        })

        if (existingReports.length !== 0) {
            const existingReport = existingReports[0]

            if (existingReport.id !== report.id) {
                await this.provider.update({ _id: existingReport.id }, { $set: { pin: false } })
            }
        }

        return this.provider.update({ _id: report.id }, { $set: { pin: !report.pin } })
    }

    async getBranches(reportOwner, reportName) {
        const { id, source, _p_user } = await this.getReport(reportOwner, reportName)
        let branches

        if (source.provider === LOCAL_REPORT_HOST) {
            branches = await this.localReportsService.getReportVersions(id)
        } else {
            const { accessToken } = await this.usersService.getUser({
                filter: { _id: _p_user },
            })

            // OLD
            // branches = await this.reposService({ provider: source.provider, accessToken }).getBranches(source.owner, source.name)
            switch (source.provider) {
                case 'github':
                default:
                    this.githubReposService.login(accessToken)
                    branches = await this.githubReposService.getBranches(source.owner, source.name)
                    break
            }

            branches.forEach((branch) => {
                branch.is_default = branch === source.defaultBranch
            })
        }

        return branches
    }

    async getCommits(reportOwner, reportName, branch) {
        const { source, _p_user } = await this.getReport(reportOwner, reportName)
        if (source.provider === LOCAL_REPORT_HOST)
            throw new InvalidInputError({
                message: 'This functionality is not available in S3',
            })

        const { accessToken } = await this.usersService.getUser({
            filter: { _id: _p_user },
        })
        // OLD
        // const commits = await this.reposService({ provider: source.provider, accessToken }).getCommits(source.owner, source.name, branch)
        let commits
        switch (source.provider) {
            case 'github':
            default:
                this.githubReposService.login(accessToken)
                commits = await this.githubReposService.getCommits(source.owner, source.name, branch)
                break
        }
        return commits
    }

    async getFileHash(reportOwner, reportName, branch, path) {
        const { id, source, _p_user } = await this.getReport(reportOwner, reportName)
        let data = {}

        if (source.provider === LOCAL_REPORT_HOST) {
            data = await this.localReportsService.getFileHash(id, branch)
        } else {
            const { accessToken } = await this.usersService.getUser({
                filter: { _id: _p_user },
            })
            const fullPath = `${source.basePath}${path}`
            // OLD
            // data = await this.reposService({ provider: source.provider, accessToken }).getFileHash(fullPath, source.owner, source.name, branch)
            switch (source.provider) {
                case 'github':
                default:
                    this.githubReposService.login(accessToken)
                    data = await this.githubReposService.getFileHash(fullPath, source.owner, source.name, branch)
                    break
            }
        }

        return data
    }

    async getReportFileContent(reportOwner, reportName, hash) {
        const { id, source, _p_user } = await this.getReport(reportOwner, reportName)
        let content

        if (source.provider === LOCAL_REPORT_HOST) {
            content = await this.localReportsService.getFileContent(id, hash)
        } else {
            const { accessToken } = await this.usersService.getUser({
                filter: { _id: _p_user },
            })
            // OLD
            // content = await this.reposService({ provider: source.provider, accessToken }).getFileContent(hash, source.owner, source.name)

            switch (source.provider) {
                case 'github':
                default:
                    this.githubReposService.login(accessToken)
                    content = await this.githubReposService.getFileContent(hash, source.owner, source.name)
                    break
            }
        }

        return content
    }
}
