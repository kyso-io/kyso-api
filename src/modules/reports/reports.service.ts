import { CreateReportDTO, Report, User } from '@kyso-io/kyso-model'
import { Injectable, Logger, PreconditionFailedException, Provider } from '@nestjs/common'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { AlreadyExistsError, InvalidInputError, NotFoundError } from '../../helpers/errorHandling'
import { Validators } from '../../helpers/validators'
import { GithubReposService } from '../github-repos/github-repos.service'
import { TeamsService } from '../teams/teams.service'
import { UsersService } from '../users/users.service'
import { LocalReportsService } from './local-reports.service'
import { ReportsMongoProvider } from './providers/mongo-reports.provider'

const CREATE_REPORT_FIELDS = ['main', 'title', 'description', 'preview', 'tags', 'authors', 'team_id']
const LOCAL_REPORT_HOST = 's3'

function generateReportName(repoName, path) {
    const pathName = path.replace(/\//g, '_')
    return repoName + (pathName ? '_' : '') + pathName
}

function factory(service: ReportsService) {
    return service
}

export function createProvider(): Provider<ReportsService> {
    return {
        provide: `${ReportsService.name}`,
        useFactory: (service) => factory(service),
        inject: [ReportsService],
    }
}

@Injectable()
export class ReportsService extends AutowiredService {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    @Autowired({ typeName: 'TeamsService' })
    private teamsService: TeamsService

    @Autowired({ typeName: 'GithubReposService' })
    private githubReposService: GithubReposService

    @Autowired({ typeName: 'LocalReportsService' })
    private localReportsService: LocalReportsService

    constructor(private readonly provider: ReportsMongoProvider) {
        super()
    }

    async getReports(query): Promise<Report[]> {
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
                query.filter.user_id = results[0].value.id
            } else if (results[1].status === 'fulfilled') {
                query.filter.team_id = results[1].value.id
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
        return reports as Report[]
    }

    async getReport(reportOwner, reportName): Promise<Report> {
        const reports = await this.getReports({
            filter: {
                owner: reportOwner,
                name: reportName,
            },
            limit: 1,
        })

        if (reports.length === 0) {
            throw new NotFoundError({
                message: "The specified report couldn't be found",
            })
        }

        return reports[0]
    }

    public async getReportById(reportId: string): Promise<Report> {
        const reports: Report[] = await this.provider.read({ _id: this.provider.toObjectId(reportId) })
        return reports.length === 1 ? reports[0] : null
    }

    async createReport(user: User, CreateReportDTORequest: CreateReportDTO, teamName) {
        if (!Validators.isValidReportName(CreateReportDTORequest.name))
            throw new InvalidInputError({
                message: `Study name can only consist of letters, numbers, '_' and '-'.`,
            })

        const basePath = (CreateReportDTORequest.path || '').replace(/^[.]\//, '')
        const reportName = CreateReportDTORequest.name

        // const reportName = generateReportName(CreateReportDTORequest.name, basePath)

        // OLD line... what is he doing with the result of this???
        // await this.reposService({ provider: CreateReportDTORequest.src.provider, accessToken: user.accessToken }).getRepo(user, CreateReportDTORequest.src.owner, CreateReportDTORequest.src.name)

        // NEW
        switch (CreateReportDTORequest.provider) {
            case 'github':
                if (!user.accessToken) {
                    Logger.error(`User ${user.username} does not have a valid accessToken to make login in Github`, ReportsService.name)
                    break
                }
                this.githubReposService.login(user.accessToken)
                await this.githubReposService.getRepo(user, CreateReportDTORequest.owner, CreateReportDTORequest.name)
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
            const { id: teamId } = await this.teamsService.getTeam({
                filter: { name: teamName },
            })

            report.team_id = teamId
            usedNameQuery.filter.team_id = report.team_id
        } else {
            usedNameQuery.filter.user_id = report.user_id
            report.team_id = CreateReportDTORequest.team_id
        }

        const reports = await this.provider.read(usedNameQuery)
        if (reports.length !== 0)
            throw new AlreadyExistsError({
                message: 'The specified name is already used by another report',
            })

        let metadata = {}
        try {
            // OLD LINE
            // metadata = await this.reposService({ provider: data.src.provider, accessToken: user.accessToken }).getConfigFile(basePath, data.src.owner, data.src.name, data.src.default_branch)
            switch (CreateReportDTORequest.provider) {
                case 'github':
                    if (!user.accessToken) {
                        Logger.error(`User ${user.username} does not have a valid accessToken to make login in Github`, ReportsService.name)
                        break
                    }
                    this.githubReposService.login(user.accessToken)
                    metadata = this.githubReposService.getConfigFile(
                        basePath,
                        CreateReportDTORequest.owner,
                        CreateReportDTORequest.name,
                        CreateReportDTORequest.default_branch,
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
                source: CreateReportDTORequest.provider,
                owner: CreateReportDTORequest.owner,
                name: CreateReportDTORequest.name,
                defaultBranch: CreateReportDTORequest.default_branch,
                basePath,
            },
            links: {},
            numberOfComments: 0,
            stars: 0,
            views: 0,
        }

        return this.provider.create(report)
    }

    async updateReport(reportId: string, data: any): Promise<Report> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new NotFoundError({ message: 'The specified report could not be found' })
        }
        return this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: data })
    }

    public async deleteReport(reportId: string): Promise<Report> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new NotFoundError({ message: 'The specified report could not be found' })
        }
        await this.provider.deleteOne({ _id: this.provider.toObjectId(reportId) })
        return report
    }

    async pinReport(userId: string, reportId: string): Promise<Report> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new NotFoundError({ message: 'The specified report could not be found' })
        }
        const existingReports: Report[] = await this.getReports({
            filter: {
                user_id: userId,
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

    async getBranches(userId: string, reportId: string): Promise<any[]> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new NotFoundError({ message: 'The specified report could not be found' })
        }
        let branches: any[] = []
        if (report.provider === LOCAL_REPORT_HOST) {
            branches = await this.localReportsService.getReportVersions(report.id)
        } else {
            const user: User = await this.usersService.getUserById(userId)
            // OLD
            // branches = await this.reposService({ provider: source.provider, accessToken }).getBranches(source.owner, source.name)
            switch (report.provider) {
                case 'github':
                default:
                    this.githubReposService.login(user.accessToken)
                    branches = await this.githubReposService.getBranches(userId, report.name)
                    break
            }
            branches.forEach((branch: any) => {
                branch.is_default = branch === report.source.defaultBranch
            })
        }
        return branches
    }

    async getCommits(userId: string, reportId: string, branch: string): Promise<any[]> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new NotFoundError({ message: 'The specified report could not be found' })
        }
        if (report.source.provider === LOCAL_REPORT_HOST) {
            throw new InvalidInputError({
                message: 'This functionality is not available in S3',
            })
        }
        const user: User = await this.usersService.getUserById(userId)
        // OLD
        // const commits = await this.reposService({ provider: source.provider, accessToken }).getCommits(source.owner, source.name, branch)
        let commits: any[] = []
        switch (report.source.provider) {
            case 'github':
            default:
                this.githubReposService.login(user.accessToken)
                commits = await this.githubReposService.getCommits(userId, reportId, branch)
                break
        }
        return commits
    }

    async getFileHash(userId: string, reportId: string, branch: string, path: string): Promise<any> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new NotFoundError({ message: 'The specified report could not be found' })
        }
        let data = {}
        if (report.source.provider === LOCAL_REPORT_HOST) {
            data = await this.localReportsService.getFileHash(report.id, branch)
        } else {
            const user: User = await this.usersService.getUserById(userId)
            const fullPath = `${report.source.basePath}${path}`
            // OLD
            // data = await this.reposService({ provider: source.provider, accessToken }).getFileHash(fullPath, source.owner, source.name, branch)
            switch (report.source.provider) {
                case 'github':
                default:
                    this.githubReposService.login(user.accessToken)
                    data = await this.githubReposService.getFileHash(fullPath, report.source.owner, report.source.name, branch)
                    break
            }
        }

        return data
    }

    async getReportFileContent(userId: string, reportId: string, hash: string): Promise<any> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('The specified report could not be found')
        }
        let content
        if (report.source.provider === LOCAL_REPORT_HOST) {
            content = await this.localReportsService.getFileContent(hash)
        } else {
            const user: User = await this.usersService.getUserById(userId)
            if (!user) {
                throw new PreconditionFailedException('The specified user could not be found')
            }
            // OLD
            // content = await this.reposService({ provider: source.provider, accessToken }).getFileContent(hash, source.owner, source.name)
            switch (report.source.provider) {
                case 'github':
                default:
                    this.githubReposService.login(user.accessToken)
                    content = await this.githubReposService.getFileContent(hash, userId, report.source.name)
                    break
            }
        }

        return content
    }
}
