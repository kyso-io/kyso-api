import { Injectable, Logger } from '@nestjs/common'
import { AlreadyExistsError, InvalidInputError, NotFoundError } from '../../helpers/errorHandling'
import { QueryParser } from '../../helpers/queryParser'
import { Validators } from '../../helpers/validators'
import { githubReposService, localReportsService, teamsService, usersService } from '../../main'
import { CreateReport } from '../../model/dto/create-report-request.dto'
import { Report } from '../../model/report.model'
import { User } from '../../model/user.model'
import { ReportsMongoProvider } from './providers/mongo-reports.provider'

const CREATE_REPORT_FIELDS = ['main', 'title', 'description', 'preview', 'tags', 'authors', 'team_id']
const LOCAL_REPORT_HOST = 's3'

function generateReportName(repoName, path) {
    const pathName = path.replace(/\//g, '_')
    return repoName + (pathName ? '_' : '') + pathName
}

@Injectable()
export class ReportsService {
    constructor(private readonly provider: ReportsMongoProvider) {}

    async getReports(query) {
        if (query.filter && query.filter.owner) {
            const results = await Promise.allSettled([
                usersService.getUser({
                    filter: { nickname: query.filter.owner },
                }),
                teamsService.getTeam({
                    filter: { name: query.filter.owner },
                }),
            ])

            delete query.filter.owner
            if (results[0].status === 'fulfilled') {
                query.filter.user_id = results[0].value.id
            } else if (results[1].status === 'fulfilled') {
                query.filter._p_team = results[1].value.id
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

    async createReport(user: User, createReportRequest: CreateReport, teamName) {
        if (!Validators.isValidReportName(createReportRequest.name))
            throw new InvalidInputError({
                message: `Study name can only consist of letters, numbers, '_' and '-'.`,
            })

        const basePath = (createReportRequest.path || '').replace(/^[.]\//, '')
        const reportName = createReportRequest.name

        // const reportName = generateReportName(createReportRequest.name, basePath)

        // OLD line... what is he doing with the result of this???
        // await this.reposService({ provider: createReportRequest.src.provider, accessToken: user.accessToken }).getRepo(user, createReportRequest.src.owner, createReportRequest.src.name)

        // NEW
        switch (createReportRequest.provider) {
            case 'github':
                if (!user.accessToken) {
                    Logger.error(`User ${user.username} does not have a valid accessToken to make login in Github`, ReportsService.name)
                    break
                }
                githubReposService.login(user.accessToken)
                await githubReposService.getRepo(user, createReportRequest.owner, createReportRequest.name)
                break
            default:
                break
        }
        // END NEW
        let report = {
            user_id: user.id,
        } as any
        const usedNameQuery = {
            filter: {
                name: reportName,
                limit: 1,
            },
        } as any

        if (teamName) {
            const { id: teamId } = await teamsService.getTeam({
                filter: { name: teamName },
            })

            report._p_team = QueryParser.createForeignKey('Team', teamId)
            usedNameQuery.filter._p_team = report._p_team
        } else usedNameQuery.filter.user_id = report.user_id

        const reports = await this.provider.read(usedNameQuery)
        if (reports.length !== 0)
            throw new AlreadyExistsError({
                message: 'The specified name is already used by another report',
            })

        let metadata = {}
        try {
            // OLD LINE
            // metadata = await this.reposService({ provider: data.src.provider, accessToken: user.accessToken }).getConfigFile(basePath, data.src.owner, data.src.name, data.src.default_branch)
            switch (createReportRequest.provider) {
                case 'github':
                    if (!user.accessToken) {
                        Logger.error(`User ${user.username} does not have a valid accessToken to make login in Github`, ReportsService.name)
                        break
                    }
                    githubReposService.login(user.accessToken)
                    metadata = githubReposService.getConfigFile(
                        basePath,
                        createReportRequest.owner,
                        createReportRequest.name,
                        createReportRequest.default_branch,
                    )
                    break
                default:
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
                source: createReportRequest.provider,
                owner: createReportRequest.owner,
                name: createReportRequest.name,
                defaultBranch: createReportRequest.default_branch,
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

        return this.provider.update({ _id: this.provider.toObjectId(report.id) }, data)
    }

    async deleteReport(userId, reportOwner, reportName) {
        const report = await this.getReport(reportOwner, reportName)

        await this.provider.delete({ _id: this.provider.toObjectId(report.id) })
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
        const { id, source, user_id } = await this.getReport(reportOwner, reportName)
        let branches

        if (source.provider === LOCAL_REPORT_HOST) {
            branches = await localReportsService.getReportVersions(id)
        } else {
            const { accessToken } = await usersService.getUser({
                filter: { _id: user_id },
            })

            // OLD
            // branches = await this.reposService({ provider: source.provider, accessToken }).getBranches(source.owner, source.name)
            switch (source.provider) {
                case 'github':
                default:
                    githubReposService.login(accessToken)
                    branches = await githubReposService.getBranches(source.owner, source.name)
                    break
            }

            branches.forEach((branch) => {
                branch.is_default = branch === source.defaultBranch
            })
        }

        return branches
    }

    async getCommits(reportOwner, reportName, branch) {
        const { source, user_id } = await this.getReport(reportOwner, reportName)
        if (source.provider === LOCAL_REPORT_HOST)
            throw new InvalidInputError({
                message: 'This functionality is not available in S3',
            })

        const { accessToken } = await usersService.getUser({
            filter: { _id: user_id },
        })
        // OLD
        // const commits = await this.reposService({ provider: source.provider, accessToken }).getCommits(source.owner, source.name, branch)
        let commits
        switch (source.provider) {
            case 'github':
            default:
                githubReposService.login(accessToken)
                commits = await githubReposService.getCommits(source.owner, source.name, branch)
                break
        }
        return commits
    }

    async getFileHash(reportOwner, reportName, branch, path) {
        const { id, source, user_id } = await this.getReport(reportOwner, reportName)
        let data = {}

        if (source.provider === LOCAL_REPORT_HOST) {
            data = await localReportsService.getFileHash(id, branch)
        } else {
            const { accessToken } = await usersService.getUser({
                filter: { _id: user_id },
            })
            const fullPath = `${source.basePath}${path}`
            // OLD
            // data = await this.reposService({ provider: source.provider, accessToken }).getFileHash(fullPath, source.owner, source.name, branch)
            switch (source.provider) {
                case 'github':
                default:
                    githubReposService.login(accessToken)
                    data = await githubReposService.getFileHash(fullPath, source.owner, source.name, branch)
                    break
            }
        }

        return data
    }

    async getReportFileContent(reportOwner, reportName, hash) {
        const { id, source, user_id } = await this.getReport(reportOwner, reportName)
        let content

        if (source.provider === LOCAL_REPORT_HOST) {
            content = await localReportsService.getFileContent(id, hash)
        } else {
            const { accessToken } = await usersService.getUser({
                filter: { _id: user_id },
            })
            // OLD
            // content = await this.reposService({ provider: source.provider, accessToken }).getFileContent(hash, source.owner, source.name)

            switch (source.provider) {
                case 'github':
                default:
                    githubReposService.login(accessToken)
                    content = await githubReposService.getFileContent(hash, source.owner, source.name)
                    break
            }
        }

        return content
    }

    public async getById(id: string): Promise<Report> {
        const reports: Report[] = await this.provider.read({ filter: { _id: this.provider.toObjectId(id) } })
        return reports.length === 1 ? reports[0] : null
    }
}
