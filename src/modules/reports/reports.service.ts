import { PutObjectCommand, PutObjectCommandOutput, S3Client } from '@aws-sdk/client-s3'
import {
    Comment,
    CreateKysoReportDTO,
    CreateReportDTO,
    File,
    GithubBranch,
    GithubCommit,
    GithubFileHash,
    GithubRepository,
    GlobalPermissionsEnum,
    KysoConfigFile,
    Organization,
    OrganizationMemberJoin,
    PinnedReport,
    Report,
    ReportDTO,
    RepositoryProvider,
    StarredReport,
    Team,
    UpdateReportRequestDTO,
    User,
} from '@kyso-io/kyso-model'
import { EntityEnum } from '@kyso-io/kyso-model/dist/enums/entity.enum'
import { Injectable, Logger, PreconditionFailedException, Provider } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { NotFoundError } from '../../helpers/errorHandling'
import { Validators } from '../../helpers/validators'
import { CommentsService } from '../comments/comments.service'
import { GithubReposService } from '../github-repos/github-repos.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { TagsService } from '../tags/tags.service'
import { TeamsService } from '../teams/teams.service'
import { UsersService } from '../users/users.service'
import { LocalReportsService } from './local-reports.service'
import { FilesMongoProvider } from './providers/mongo-files.provider'
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

    @Autowired({ typeName: 'OrganizationsService' })
    private organizationsService: OrganizationsService

    constructor(
        private readonly provider: ReportsMongoProvider,
        private readonly pinnedReportsMongoProvider: PinnedReportsMongoProvider,
        private readonly starredReportsMongoProvider: StarredReportsMongoProvider,
        private readonly filesMongoProvider: FilesMongoProvider,
    ) {
        super()
    }

    public async getReports(query): Promise<Report[]> {
        return this.provider.read(query)
    }

    public async getReportById(reportId: string): Promise<Report> {
        const reports: Report[] = await this.provider.read({ filter: { _id: this.provider.toObjectId(reportId) } })
        return reports.length === 1 ? reports[0] : null
    }

    public async createReport(userId: string, createReportDto: CreateReportDTO): Promise<Report> {
        if (!Validators.isValidReportName(createReportDto.name)) {
            throw new PreconditionFailedException({
                message: `Report name can only consist of letters, numbers, '_' and '-'.`,
            })
        }

        const user: User = await this.usersService.getUserById(userId)

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
        let kysoConfigFile: KysoConfigFile = null
        if (user?.accessToken && user.accessToken.length > 0) {
            // Try to get github repository
            this.githubReposService.login(user.accessToken)
            const githubRepository: GithubRepository = await this.githubReposService.getGithubRepository(
                createReportDto.username_provider,
                createReportDto.name,
            )
            Logger.log(`Got github repository ${githubRepository.name}`, ReportsService.name)
            kysoConfigFile = await this.githubReposService.getConfigFile(
                createReportDto.path,
                createReportDto.username_provider,
                createReportDto.name,
                createReportDto.default_branch,
            )
            if (!kysoConfigFile) {
                throw new PreconditionFailedException(`The specified repository doesn't contain a Kyso config file`)
            }
        }

        const report: Report = new Report(
            createReportDto.name,
            null,
            null,
            createReportDto.provider,
            createReportDto.username_provider,
            createReportDto.default_branch,
            createReportDto.path,
            1,
            false,
            kysoConfigFile ? kysoConfigFile.description : createReportDto.description,
            user.id,
            team.id,
            createReportDto.title,
            [],
        )
        return this.provider.create(report)
    }

    public async updateReport(userId: string, reportId: string, updateReportRequestDTO: UpdateReportRequestDTO): Promise<Report> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new NotFoundError({ message: 'The specified report could not be found' })
        }
        const author_ids: string[] = [...report.author_ids]
        if (author_ids.indexOf(userId) === -1) {
            author_ids.push(userId)
        }
        return this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { ...updateReportRequestDTO, author_ids } })
    }

    public async deleteReport(reportId: string): Promise<Report> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new NotFoundError({ message: 'The specified report could not be found' })
        }

        // Delete all comments
        await this.commentsService.deleteReportComments(reportId)

        // Delete relations with tags
        await this.tagsService.removeTagRelationsOfEntity(reportId)

        // Delete relations with pinned reports
        await this.pinnedReportsMongoProvider.deleteMany({ report_id: reportId })

        // Delete relations with starred reports
        await this.starredReportsMongoProvider.deleteMany({ report_id: reportId })

        // Delete files
        await this.filesMongoProvider.deleteMany({ report_id: reportId })

        await this.provider.deleteOne({ _id: this.provider.toObjectId(reportId) })
        return report
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
            report.title,
            report.author_ids,
        )
    }

    public async getPinnedReportsForUser(userId: string): Promise<Report[]> {
        const pinnedReports: PinnedReport[] = await this.pinnedReportsMongoProvider.read({
            filter: {
                user_id: userId,
            },
        })
        return this.getReports({
            filter: { _id: { $in: pinnedReports.map((pinnedReport: PinnedReport) => this.provider.toObjectId(pinnedReport.report_id)) } },
        })
    }

    public async deleteStarredReportsByUser(userId: string): Promise<void> {
        await this.starredReportsMongoProvider.deleteMany({ user_id: userId })
    }

    public async deletePinnedReportsByUser(userId: string): Promise<void> {
        await this.pinnedReportsMongoProvider.deleteMany({ user_id: userId })
    }

    public async increaseViews(filter: any): Promise<void> {
        await this.provider.update(filter, { $inc: { views: 1 } })
    }

    public async createKysoReport(userId: string, createKysoReportDTO: CreateKysoReportDTO, files: Express.Multer.File[]): Promise<Report> {
        const user: User = await this.usersService.getUserById(userId)
        const isGlobalAdmin: boolean = user.global_permissions.includes(GlobalPermissionsEnum.GLOBAL_ADMIN)

        const organization: Organization = await this.organizationsService.getOrganization({ filter: { name: createKysoReportDTO.organization } })
        if (!organization) {
            throw new PreconditionFailedException(`Organization ${createKysoReportDTO.organization} does not exist`)
        }

        const organizationMembersJoin: OrganizationMemberJoin[] = await this.organizationsService.isUserInOrganization(user, organization)
        if (!isGlobalAdmin && organizationMembersJoin.length === 0) {
            throw new PreconditionFailedException(`User ${user.nickname} is not a member of organization ${createKysoReportDTO.organization}`)
        }

        const team: Team = await this.teamsService.getTeam({ filter: { name: createKysoReportDTO.team } })
        if (!team) {
            throw new PreconditionFailedException(`Team ${createKysoReportDTO.team} does not exist`)
        }
        if (team.organization_id !== organization.id) {
            throw new PreconditionFailedException(`Team ${createKysoReportDTO.team} does not belong to organization ${createKysoReportDTO.organization}`)
        }
        const belongsToTeam: boolean = await this.teamsService.userBelongsToTeam(team.id, user.id)
        if (!isGlobalAdmin && !belongsToTeam) {
            throw new PreconditionFailedException(`User ${user.nickname} is not a member of team ${createKysoReportDTO.team}`)
        }

        const name: string = encodeURIComponent(createKysoReportDTO.title.replace(/ /g, '-'))
        const reports: Report[] = await this.provider.read({ filter: { name, team_id: team.id } })
        if (reports.length > 0) {
            throw new PreconditionFailedException(`Report with name ${createKysoReportDTO.title} already exists`)
        }

        let report: Report = new Report(
            name,
            null,
            null,
            RepositoryProvider.KYSO_CLI,
            null,
            null,
            null,
            0,
            false,
            createKysoReportDTO.description,
            userId,
            team.id,
            createKysoReportDTO.title,
            [],
        )
        report.report_type = 'kyso-cli'
        report = await this.provider.create(report)

        const s3Client: S3Client = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        })

        for (let i = 0; i < files.length; i++) {
            const sha: string = createKysoReportDTO.original_shas[i]
            const size: number = parseInt(createKysoReportDTO.original_sizes[i], 10)
            const originalName: string = createKysoReportDTO.original_names[i]
            const path_s3 = `${uuidv4()}_${sha}_${originalName}.zip`
            let file: File = new File(report.id, originalName, path_s3, size, sha, 1)
            file = await this.filesMongoProvider.create(file)
            Logger.log(`Report '${report.name}': uploading file '${file.name}' to S3...`, ReportsService.name)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const data: PutObjectCommandOutput = await s3Client.send(
                new PutObjectCommand({
                    Bucket: process.env.AWS_S3_BUCKET,
                    Key: path_s3,
                }),
            )
            Logger.log(`Report '${report.name}': uploaded file '${file.name}' to S3 with key '${file.path_s3}'`, ReportsService.name)
        }

        return report
    }
}
