import {
    Comment,
    CreateReportDTO,
    GithubBranch,
    GithubCommit,
    GithubFileHash,
    GithubRepository,
    KysoConfigFile,
    PinnedReport,
    Report,
    ReportDTO,
    RepositoryProvider,
    StarredReport,
    Team,
    User,
} from '@kyso-io/kyso-model'
import { EntityEnum } from '@kyso-io/kyso-model/dist/enums/entity.enum'
import { Injectable, Logger, PreconditionFailedException, Provider } from '@nestjs/common'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { NotFoundError } from '../../helpers/errorHandling'
import { Validators } from '../../helpers/validators'
import { CommentsService } from '../comments/comments.service'
import { GithubReposService } from '../github-repos/github-repos.service'
import { TagsService } from '../tags/tags.service'
import { TeamsService } from '../teams/teams.service'
import { UsersService } from '../users/users.service'
import { LocalReportsService } from './local-reports.service'
import { PinnedReportsMongoProvider } from './providers/mongo-pinned-reports.provider'
import { ReportsMongoProvider } from './providers/mongo-reports.provider'
import { StarredReportsMongoProvider } from './providers/mongo-starred-reports.provider'

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

    @Autowired({ typeName: 'CommentsService' })
    private commentsService: CommentsService

    @Autowired({ typeName: 'TagsService' })
    private tagsService: TagsService

    constructor(
        private readonly provider: ReportsMongoProvider,
        private readonly pinnedReportsMongoProvider: PinnedReportsMongoProvider,
        private readonly starredReportsMongoProvider: StarredReportsMongoProvider,
    ) {
        super()
    }

    public async getReports(query): Promise<Report[]> {
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

    public async getReport(reportOwner, reportName): Promise<Report> {
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

    public async createReport(userId: string, createReportDto: CreateReportDTO): Promise<Report> {
        if (!Validators.isValidReportName(createReportDto.name)) {
            throw new PreconditionFailedException({
                message: `Report name can only consist of letters, numbers, '_' and '-'.`,
            })
        }

        const user: User = await this.usersService.getUserById(userId)
        if (user.accessToken == null || user.accessToken.length === 0) {
            throw new PreconditionFailedException(`User ${user.nickname} has no access token`)
        }

        // Try to get github repository
        this.githubReposService.login(user.accessToken)
        const githubRepository: GithubRepository = await this.githubReposService.getGithubRepository(createReportDto.username_provider, createReportDto.name)
        Logger.log(`Got github repository ${githubRepository.name}`, ReportsService.name)

        // Check if team exists
        const team: Team = await this.teamsService.getTeamById(createReportDto.team_id)
        if (!team) {
            throw new PreconditionFailedException("The specified team couldn't be found")
        }

        // Check if exists a report with this name
        const reports: Report[] = await this.getReports({
            filter: {
                name: createReportDto.name,
            },
        })
        if (reports.length !== 0) {
            throw new PreconditionFailedException({
                message: 'The specified name is already used by another report',
            })
        }

        createReportDto.path = (createReportDto.path || '').replace(/^[.]\//, '')
        const kysoConfigFile: KysoConfigFile = await this.githubReposService.getConfigFile(
            createReportDto.path,
            createReportDto.username_provider,
            createReportDto.name,
            createReportDto.default_branch,
        )
        if (!kysoConfigFile) {
            throw new PreconditionFailedException(`The specified repository doesn't contain a Kyso config file`)
        }

        const report: Report = new Report(
            createReportDto.name,
            createReportDto.provider,
            createReportDto.username_provider,
            createReportDto.default_branch,
            createReportDto.path,
            0,
            false,
            kysoConfigFile.description,
            user.id,
            team.id,
        )
        return this.provider.create(report)
    }

    public async updateReport(reportId: string, data: any): Promise<Report> {
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

    public async pinReport(userId: string, reportId: string): Promise<Report> {
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

    public async getBranches(userId: string, reportId: string): Promise<GithubBranch[]> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('The specified report could not be found')
        }
        if (report.provider === RepositoryProvider.KYSO) {
            return this.localReportsService.getReportVersions(report.id)
        } else {
            const user: User = await this.usersService.getUserById(userId)
            if (user.accessToken == null || user.accessToken.length === 0) {
                throw new PreconditionFailedException(`User ${user.nickname} has no access token`)
            }
            this.githubReposService.login(user.accessToken)
            return this.githubReposService.getBranches(user.id, report.name)
        }
    }

    public async getCommits(userId: string, reportId: string, branch: string): Promise<GithubCommit[]> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('The specified report could not be found')
        }
        if (report.provider === RepositoryProvider.KYSO) {
            throw new PreconditionFailedException({
                message: 'This functionality is not available in S3',
            })
        }
        const user: User = await this.usersService.getUserById(userId)
        if (user.accessToken == null || user.accessToken.length === 0) {
            throw new PreconditionFailedException(`User ${user.nickname} has no access token`)
        }
        this.githubReposService.login(user.accessToken)
        return this.githubReposService.getCommits(userId, report.id, branch)
    }

    public async getFileHash(userId: string, reportId: string, branch: string, path: string): Promise<GithubFileHash | GithubFileHash[]> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new NotFoundError({ message: 'The specified report could not be found' })
        }
        if (report.provider === RepositoryProvider.KYSO) {
            return this.localReportsService.getFileHash(report.id, branch)
        } else {
            const user: User = await this.usersService.getUserById(userId)
            if (user.accessToken == null || user.accessToken.length === 0) {
                throw new PreconditionFailedException(`User ${user.nickname} has no access token`)
            }
            const fullPath = `${report.path}${path}`
            this.githubReposService.login(user.accessToken)
            return this.githubReposService.getFileHash(fullPath, report.username_provider, report.name, branch)
        }
    }

    public async getReportFileContent(userId: string, reportId: string, hash: string): Promise<Buffer> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('The specified report could not be found')
        }
        if (report.provider === RepositoryProvider.KYSO) {
            return this.localReportsService.getFileContent(hash)
        } else {
            const user: User = await this.usersService.getUserById(userId)
            if (user.accessToken == null || user.accessToken.length === 0) {
                throw new PreconditionFailedException(`User ${user.nickname} has no access token`)
            }
            this.githubReposService.login(user.accessToken)
            return this.githubReposService.getFileContent(hash, userId, report.name)
        }
    }

    public async toggleUserPin(userId: string, reportId: string): Promise<Report> {
        const pinnedReports: PinnedReport[] = await this.pinnedReportsMongoProvider.read({
            filter: {
                user_id: userId,
                report_id: reportId,
            },
        })
        if (pinnedReports.length === 0) {
            await this.pinnedReportsMongoProvider.create({
                user_id: userId,
                report_id: reportId,
            })
        } else {
            const pinnedReport: PinnedReport = pinnedReports[0]
            await this.pinnedReportsMongoProvider.deleteOne({ _id: this.provider.toObjectId(pinnedReport.id) })
        }
        return this.getReportById(reportId)
    }

    public async toggleUserStar(userId: string, reportId: string): Promise<Report> {
        const starredReports: StarredReport[] = await this.starredReportsMongoProvider.read({
            filter: {
                user_id: userId,
                report_id: reportId,
            },
        })
        if (starredReports.length === 0) {
            await this.starredReportsMongoProvider.create({
                user_id: userId,
                report_id: reportId,
            })
        } else {
            const pinnedReport: StarredReport = starredReports[0]
            await this.starredReportsMongoProvider.deleteOne({ _id: this.provider.toObjectId(pinnedReport.id) })
        }
        return this.getReportById(reportId)
    }

    public async reportModelToReportDTO(report: Report, userId: string): Promise<ReportDTO> {
        const pinnedReport: StarredReport[] = await this.pinnedReportsMongoProvider.read({
            filter: {
                user_id: userId,
                report_id: report.id,
            },
        })
        const userPin = pinnedReport.length > 0
        const numberOfStars: number = await this.starredReportsMongoProvider.count({ filter: { report_id: report.id } })
        const starredReport: StarredReport[] = await this.starredReportsMongoProvider.read({
            filter: {
                user_id: userId,
                report_id: report.id,
            },
        })
        const markAsStar: boolean = starredReport.length > 0
        const comments: Comment[] = await this.commentsService.getComments({ filter: { report_id: report.id } })
        const tagIds: string[] = await this.tagsService.getTagIdsOfEntity(report.id, EntityEnum.REPORT)
        return new ReportDTO(
            report.id,
            report.created_at,
            report.updated_at,
            report?.links ? (report.links as any) : null,
            report.name,
            report.report_type,
            report.views,
            report.provider,
            report.pin,
            userPin,
            numberOfStars,
            markAsStar,
            comments.length,
            tagIds,
            report.description,
            report.user_id,
            comments.map((comment: Comment) => comment.id),
            report.team_id,
        )
    }

    public async getReportDtos(userId: string, query: any): Promise<ReportDTO[]> {
        const reports: Report[] = await this.getReports(query)
        return Promise.all(reports.map((report: Report) => this.reportModelToReportDTO(report, userId)))
    }

    public async getPinnedReportsForUser(userId: string): Promise<ReportDTO[]> {
        const pinnedReports: PinnedReport[] = await this.pinnedReportsMongoProvider.read({
            filter: {
                user_id: userId,
            },
        })
        const reportIds: string[] = pinnedReports.map((pinnedReport: PinnedReport) => pinnedReport.report_id)
        const reports: Report[] = await this.getReports({ filter: { id: { $in: reportIds } } })
        return Promise.all(reports.map((report: Report) => this.reportModelToReportDTO(report, userId)))
    }
}
