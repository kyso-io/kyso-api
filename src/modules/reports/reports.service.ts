import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import {
    Comment,
    CreateKysoReportDTO,
    CreateReportDTO,
    CreateUIReportDTO,
    File,
    GithubBranch,
    GithubCommit,
    GithubFileHash,
    GithubRepository,
    GlobalPermissionsEnum,
    KysoConfigFile,
    LoginProviderEnum,
    Organization,
    PinnedReport,
    Report,
    ReportDTO,
    ReportStatus,
    RepositoryProvider,
    StarredReport,
    Tag,
    Team,
    Token,
    UpdateReportRequestDTO,
    User,
    UserAccount,
} from '@kyso-io/kyso-model'
import { EntityEnum } from '@kyso-io/kyso-model/dist/enums/entity.enum'
import { Injectable, Logger, NotFoundException, PreconditionFailedException, Provider } from '@nestjs/common'
import { Octokit } from '@octokit/rest'
import * as AdmZip from 'adm-zip'
import axios, { AxiosResponse } from 'axios'
import { lstatSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'fs'
import * as glob from 'glob'
import * as jsYaml from 'js-yaml'
import { extname } from 'path'
import * as sha256File from 'sha256-file'
import { Readable } from 'stream'
import { v4 as uuidv4 } from 'uuid'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { NotFoundError } from '../../helpers/errorHandling'
import slugify from '../../helpers/slugify'
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

    private getS3Client(): S3Client {
        return new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        })
    }

    public async getReports(query): Promise<Report[]> {
        return this.provider.read(query)
    }

    public async getReportById(reportId: string): Promise<Report> {
        const reports: Report[] = await this.provider.read({ filter: { _id: this.provider.toObjectId(reportId) } })
        return reports.length === 1 ? reports[0] : null
    }

    public async createReport(userId: string, createReportDto: CreateReportDTO): Promise<Report> {
        Logger.log(`Creating report ${createReportDto.name} by user ${userId}`)
        if (!Validators.isValidReportName(createReportDto.name)) {
            Logger.error(`Report name can only consist of letters, numbers, '_' and '-'.`)
            throw new PreconditionFailedException({
                message: `Report name can only consist of letters, numbers, '_' and '-'.`,
            })
        }

        const user: User = await this.usersService.getUserById(userId)
        Logger.log(`Fetched user ${user.username}`)
        // Check if team exists
        const team: Team = await this.teamsService.getTeamById(createReportDto.team_id)
        Logger.log(`Fetched team ${team.name}`)

        if (!team) {
            Logger.error("The specified team couldn't be found")
            throw new PreconditionFailedException("The specified team couldn't be found")
        }

        createReportDto.name = slugify(createReportDto.name)

        // Check if exists a report with this name
        const reports: Report[] = await this.getReports({
            filter: {
                name: createReportDto.name,
            },
        })

        if (reports.length !== 0) {
            Logger.error('The specified name is already used by another report')
            throw new PreconditionFailedException({
                message: 'The specified name is already used by another report',
            })
        }

        createReportDto.path = (createReportDto.path || '').replace(/^[.]\//, '')
        let kysoConfigFile: KysoConfigFile = null
        if (createReportDto.provider === RepositoryProvider.GITHUB) {
            const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.GITHUB)
            if (!userAccount) {
                Logger.error('User does not have a github account')
                throw new PreconditionFailedException('User does not have a github account')
            }
            const githubRepository: GithubRepository = await this.githubReposService.getGithubRepository(
                userAccount.accessToken,
                userAccount.username,
                createReportDto.name,
            )
            Logger.log(`Got github repository ${githubRepository.name}`, ReportsService.name)
            kysoConfigFile = await this.githubReposService.getConfigFile(
                userAccount.accessToken,
                createReportDto.path,
                userAccount.username,
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
            null,
        )
        Logger.log('Creating report')
        return this.provider.create(report)
    }

    public async updateReport(userId: string, reportId: string, updateReportRequestDTO: UpdateReportRequestDTO): Promise<Report> {
        Logger.log(`Updating report ${reportId}`)

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

        const s3Client: S3Client = this.getS3Client()

        // Delete report files in S3
        const reportFiles: File[] = await this.filesMongoProvider.read({ filter: { report_id: report.id } })
        for (const file of reportFiles) {
            if (file?.path_s3 && file.path_s3.length > 0) {
                Logger.log(`Report '${report.name}': deleting file ${file.name} in S3...`, ReportsService.name)
                const deleteObjectCommand: DeleteObjectCommand = new DeleteObjectCommand({
                    Bucket: process.env.AWS_S3_BUCKET,
                    Key: file.path_s3,
                })
                await s3Client.send(deleteObjectCommand)
            }
        }

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
            const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.GITHUB)
            if (!userAccount) {
                throw new PreconditionFailedException('User does not have a github account')
            }
            return this.githubReposService.getBranches(userAccount.accessToken, userAccount.username, report.name)
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
        const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.GITHUB)
        if (!userAccount) {
            throw new PreconditionFailedException('User does not have a github account')
        }
        return this.githubReposService.getCommits(userAccount.accessToken, userAccount.username, report.name, branch)
    }

    public async getReportTree(userId: string, reportId: string, branch: string, path: string): Promise<GithubFileHash | GithubFileHash[]> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new NotFoundError({ message: 'The specified report could not be found' })
        }
        switch (report.provider) {
            case RepositoryProvider.KYSO:
            case RepositoryProvider.KYSO_CLI:
                return this.getKysoReportTree(report.id, path)
            case RepositoryProvider.GITHUB:
                const user: User = await this.usersService.getUserById(userId)
                const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.GITHUB)
                if (!userAccount) {
                    throw new PreconditionFailedException('User does not have a github account')
                }
                return this.githubReposService.getFileHash(userAccount.accessToken, path, userAccount.username, report.name, branch)
            default:
                return null
        }
    }

    public async getReportFileContent(userId: string, reportId: string, hash: string): Promise<Buffer> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('The specified report could not be found')
        }
        switch (report.provider) {
            case RepositoryProvider.KYSO:
            case RepositoryProvider.KYSO_CLI:
                return this.getKysoFileContent(report.id, hash)
            case RepositoryProvider.GITHUB:
                const user: User = await this.usersService.getUserById(userId)
                const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.GITHUB)
                if (!userAccount) {
                    throw new PreconditionFailedException('User does not have a github account')
                }
                return this.githubReposService.getFileContent(userAccount.accessToken, hash, userAccount.username, report.name)
            default:
                return null
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
        const tags: Tag[] = await this.tagsService.getTagsOfEntity(report.id, EntityEnum.REPORT)
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
            tags.map((tag: Tag) => tag.name),
            report.description,
            report.user_id,
            comments,
            report.team_id,
            report.title,
            report.author_ids,
            report.status,
            report.preview_picture,
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
        Logger.log('Creating report')
        const user: User = await this.usersService.getUserById(userId)
        Logger.log(`By user: ${user.email}`)
        const isGlobalAdmin: boolean = user.global_permissions.includes(GlobalPermissionsEnum.GLOBAL_ADMIN)
        Logger.log(`is global admin?: ${isGlobalAdmin}`)

        const kysoFiles: Express.Multer.File[] = files.filter(
            (file: Express.Multer.File) =>
                file.originalname.endsWith('kyso.json') || file.originalname.endsWith('kyso.yaml') || file.originalname.endsWith('kyso.yml'),
        )
        Logger.log(`Kyso files: ${JSON.stringify(kysoFiles)}`)

        if (kysoFiles.length === 0) {
            Logger.error(`No kyso file provided`)
            throw new PreconditionFailedException('No kyso file provided')
        }

        const organization: Organization = await this.organizationsService.getOrganization({ filter: { name: createKysoReportDTO.organization } })
        Logger.log(`Organization: ${organization.name}`)
        if (!organization) {
            Logger.error(`Organization ${createKysoReportDTO.organization} does not exist`)
            throw new PreconditionFailedException(`Organization ${createKysoReportDTO.organization} does not exist`)
        }

        const userBelongsToOrganization: boolean = await this.organizationsService.userBelongsToOrganization(user.id, organization.id)
        Logger.log(`user belongs to organization?: ${userBelongsToOrganization}`)
        if (!isGlobalAdmin && !userBelongsToOrganization) {
            Logger.error(`User ${user.nickname} is not a member of organization ${createKysoReportDTO.organization}`)
            throw new PreconditionFailedException(`User ${user.nickname} is not a member of organization ${createKysoReportDTO.organization}`)
        }

        const team: Team = await this.teamsService.getTeam({ filter: { name: createKysoReportDTO.team } })
        Logger.log(`Team: ${team.name}`)
        if (!team) {
            Logger.error(`Team ${createKysoReportDTO.team} does not exist`)
            throw new PreconditionFailedException(`Team ${createKysoReportDTO.team} does not exist`)
        }
        if (team.organization_id !== organization.id) {
            Logger.error(`Team ${createKysoReportDTO.team} does not exist`)
            throw new PreconditionFailedException(`Team ${createKysoReportDTO.team} does not belong to organization ${createKysoReportDTO.organization}`)
        }
        const belongsToTeam: boolean = await this.teamsService.userBelongsToTeam(team.id, user.id)
        Logger.log(`user belongs to team?: ${belongsToTeam}`)
        if (!isGlobalAdmin && !belongsToTeam && !userBelongsToOrganization) {
            Logger.error(`User ${user.nickname} is not a member of team ${createKysoReportDTO.team} nor the organization ${createKysoReportDTO.organization}`)
            throw new PreconditionFailedException(
                `User ${user.nickname} is not a member of team ${createKysoReportDTO.team} nor the organization ${createKysoReportDTO.organization}`,
            )
        }

        const name: string = slugify(createKysoReportDTO.title)
        const reports: Report[] = await this.provider.read({ filter: { name, team_id: team.id } })
        const reportFiles: File[] = []
        let report: Report = null
        if (reports.length > 0) {
            // Existing report
            report = reports[0]
            Logger.log(`Report '${report.id} ${report.name}': Checking files...`, ReportsService.name)
            // Get all files of the report
            const reportFilesDb: File[] = await this.filesMongoProvider.read({ filter: { report_id: report.id }, sort: { version: -1 } })
            for (let i = 0; i < files.length; i++) {
                const originalName: string = createKysoReportDTO.original_names[i]
                const sha: string = createKysoReportDTO.original_shas[i]
                const size: number = parseInt(createKysoReportDTO.original_sizes[i], 10)
                const path_s3 = `${uuidv4()}_${sha}_${originalName}.zip`
                let reportFile: File = reportFilesDb.find((reportFile: File) => reportFile.name === originalName)
                if (reportFile) {
                    reportFile = new File(report.id, originalName, path_s3, size, sha, reportFile.version + 1)
                    Logger.log(`Report '${report.name}': file ${reportFile.name} new version ${reportFile.version}`, ReportsService.name)
                } else {
                    reportFile = new File(report.id, originalName, path_s3, size, sha, 1)
                    Logger.log(`Report '${report.name}': new file ${reportFile.name}`, ReportsService.name)
                }
                reportFile = await this.filesMongoProvider.create(reportFile)
                reportFiles.push(reportFile)
            }
        } else {
            Logger.log(`Creating new report '${name}'`, ReportsService.name)
            // New report
            report = new Report(
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
                null,
            )
            report.report_type = 'kyso-cli'
            report = await this.provider.create(report)
            for (let i = 0; i < files.length; i++) {
                const originalName: string = createKysoReportDTO.original_names[i]
                const sha: string = createKysoReportDTO.original_shas[i]
                const size: number = parseInt(createKysoReportDTO.original_sizes[i], 10)
                const path_s3 = `${uuidv4()}_${sha}_${originalName}.zip`
                let file: File = new File(report.id, originalName, path_s3, size, sha, 1)
                file = await this.filesMongoProvider.create(file)
                reportFiles.push(file)
            }
        }

        await this.checkReportTags(report.id, createKysoReportDTO.tags)

        new Promise<void>(async () => {
            Logger.log(`Report '${report.id} ${report.name}': Uploading files to S3...`, ReportsService.name)
            const s3Client: S3Client = this.getS3Client()
            for (let i = 0; i < files.length; i++) {
                const reportFile: File = reportFiles.find((reportFile: File) => reportFile.name === createKysoReportDTO.original_names[i])
                Logger.log(`Report '${report.name}': uploading file '${reportFile.name}' to S3...`, ReportsService.name)
                await s3Client.send(
                    new PutObjectCommand({
                        Bucket: process.env.AWS_S3_BUCKET,
                        Key: reportFile.path_s3,
                        Body: files[i].buffer,
                    }),
                )
                Logger.log(`Report '${report.name}': uploaded file '${reportFile.name}' to S3 with key '${reportFile.path_s3}'`, ReportsService.name)
            }
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Imported } })
            Logger.log(`Report '${report.id} ${report.name}' imported`, ReportsService.name)
        })

        return report
    }

    public async createUIReport(userId: string, createUIReportDTO: CreateUIReportDTO, files: any[]): Promise<Report> {
        const user: User = await this.usersService.getUserById(userId)
        const isGlobalAdmin: boolean = user.global_permissions.includes(GlobalPermissionsEnum.GLOBAL_ADMIN)

        const organization: Organization = await this.organizationsService.getOrganization({ filter: { name: createUIReportDTO.organization } })
        if (!organization) {
            throw new PreconditionFailedException(`Organization ${createUIReportDTO.organization} does not exist`)
        }

        const userBelongsToOrganization: boolean = await this.organizationsService.userBelongsToOrganization(user.id, organization.id)
        if (!isGlobalAdmin && !userBelongsToOrganization) {
            throw new PreconditionFailedException(`User ${user.nickname} is not a member of organization ${createUIReportDTO.organization}`)
        }

        const team: Team = await this.teamsService.getTeam({ filter: { name: createUIReportDTO.team } })
        if (!team) {
            throw new PreconditionFailedException(`Team ${createUIReportDTO.team} does not exist`)
        }
        if (team.organization_id !== organization.id) {
            throw new PreconditionFailedException(`Team ${createUIReportDTO.team} does not belong to organization ${createUIReportDTO.organization}`)
        }

        const name: string = slugify(createUIReportDTO.title)
        const reports: Report[] = await this.provider.read({ filter: { name, team_id: team.id } })
        const s3Client: S3Client = this.getS3Client()
        let report: Report = null
        if (reports.length > 0) {
            // Existing report
            report = reports[0]
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Processing } })
            Logger.log(`Report '${report.id} ${report.name}': Checking files...`, ReportsService.name)
            new Promise<void>(async () => {
                // Get all files of the report
                const reportFilesDb: File[] = await this.filesMongoProvider.read({ filter: { report_id: report.id }, sort: { version: -1 } })
                for (let i = 0; i < files.length; i++) {
                    const zip = new AdmZip()
                    const originalName: string = files[i].originalname
                    zip.addFile(originalName, files[i].buffer)
                    const localFilePath = `/tmp/${report.id}_${originalName}`
                    writeFileSync(localFilePath, files[i].buffer)
                    const sha: string = sha256File(localFilePath)
                    unlinkSync(localFilePath)
                    const size: number = files[i].size
                    const path_s3 = `${uuidv4()}_${sha}_${originalName}.zip`
                    let reportFile: File = reportFilesDb.find((reportFile: File) => reportFile.name === originalName)
                    if (reportFile) {
                        reportFile = new File(report.id, originalName, path_s3, size, sha, reportFile.version + 1)
                        Logger.log(`Report '${report.name}': file ${reportFile.name} new version ${reportFile.version}`, ReportsService.name)
                    } else {
                        reportFile = new File(report.id, originalName, path_s3, size, sha, 1)
                        Logger.log(`Report '${report.name}': new file ${reportFile.name}`, ReportsService.name)
                    }
                    reportFile = await this.filesMongoProvider.create(reportFile)
                    Logger.log(`Report '${report.name}': uploading file '${reportFile.name}' to S3...`, ReportsService.name)
                    await s3Client.send(
                        new PutObjectCommand({
                            Bucket: process.env.AWS_S3_BUCKET,
                            Key: path_s3,
                            Body: zip.toBuffer(),
                        }),
                    )
                    Logger.log(`Report '${report.name}': uploaded file '${report.name}' to S3 with key '${reportFile.path_s3}'`, ReportsService.name)
                }
                report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Imported } })
                Logger.log(`Report '${report.id} ${report.name}' imported`, ReportsService.name)
            })
        } else {
            Logger.log(`Creating new report '${name}'`, ReportsService.name)
            // New report
            report = new Report(
                name,
                null,
                null,
                RepositoryProvider.KYSO,
                null,
                null,
                null,
                0,
                false,
                createUIReportDTO.description,
                userId,
                team.id,
                createUIReportDTO.title,
                [],
                null,
            )
            report.report_type = 'kyso'
            report = await this.provider.create(report)
            new Promise<void>(async () => {
                for (let i = 0; i < files.length; i++) {
                    const zip = new AdmZip()
                    const originalName: string = files[i].originalname
                    zip.addFile(originalName, files[i].buffer)
                    const localFilePath = `/tmp/${report.id}_${originalName}`
                    writeFileSync(localFilePath, files[i].buffer)
                    const sha: string = sha256File(localFilePath)
                    unlinkSync(localFilePath)
                    const size: number = files[i].size
                    const path_s3 = `${uuidv4()}_${sha}_${originalName}.zip`
                    let file: File = new File(report.id, originalName, path_s3, size, sha, 1)
                    file = await this.filesMongoProvider.create(file)
                    Logger.log(`Report '${report.name}': uploading file '${file.name}' to S3...`, ReportsService.name)
                    await s3Client.send(
                        new PutObjectCommand({
                            Bucket: process.env.AWS_S3_BUCKET,
                            Key: path_s3,
                            Body: zip.toBuffer(),
                        }),
                    )
                    Logger.log(`Report '${report.name}': uploaded file '${report.name}' to S3 with key '${file.path_s3}'`, ReportsService.name)
                }
                report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Imported } })
                Logger.log(`Report '${report.id} ${report.name}' imported`, ReportsService.name)
            })
        }

        await this.checkReportTags(report.id, createUIReportDTO.tags)

        return report
    }

    public async createReportFromGithubRepository(userId: string, repositoryName: string): Promise<Report> {
        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new NotFoundError(`User ${userId} does not exist`)
        }
        const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.GITHUB)
        if (!userAccount) {
            throw new PreconditionFailedException(`User ${user.nickname} does not have a GitHub account`)
        }
        if (!userAccount.username || userAccount.username.length === 0) {
            throw new PreconditionFailedException(`User ${user.nickname} does not have a GitHub username`)
        }
        if (!userAccount.accessToken || userAccount.accessToken.length === 0) {
            throw new PreconditionFailedException(`User ${user.nickname} does not have a GitHub access token`)
        }

        const isGlobalAdmin: boolean = user.global_permissions.includes(GlobalPermissionsEnum.GLOBAL_ADMIN)

        const octokit = new Octokit({
            auth: `token ${userAccount.accessToken}`,
        })
        let repositoryResponse = null
        try {
            repositoryResponse = await octokit.repos.get({
                owner: userAccount.username,
                repo: repositoryName,
            })
            if (repositoryResponse.status !== 200) {
                throw new PreconditionFailedException(`Repository ${repositoryName} does not exist`)
            }
        } catch (e) {
            Logger.error(`Error getting repository ${repositoryName}`, e, ReportsService.name)
            throw new NotFoundException(`Repository ${repositoryName} not found`)
        }
        const repository = repositoryResponse.data

        const reports: Report[] = await this.provider.read({ filter: { name: repository.name, user_id: user.id } })
        let reportFiles: File[] = []
        let report: Report = null
        if (reports.length > 0) {
            // Existing report
            report = reports[0]
            if (report.status === ReportStatus.Processing) {
                Logger.log(`Report '${report.id} ${report.name}' is being imported`, ReportsService.name)
                return report
            }
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Processing } })
            Logger.log(`Report '${report.id} ${report.name}' already imported. Updating files...`, ReportsService.name)
        } else {
            const webhook = await this.createWebhook(octokit, userAccount.username, repository.name)
            report = new Report(
                repository.name,
                repository.id.toString(),
                webhook.id.toString(),
                RepositoryProvider.GITHUB,
                repository.owner.login,
                repository.default_branch,
                null,
                0,
                false,
                repository.description,
                user.id,
                null,
                repository.full_name,
                [],
                null,
            )
            report = await this.provider.create(report)
            Logger.log(`New report '${report.id} ${report.name}'`, ReportsService.name)
        }

        new Promise<void>(async () => {
            Logger.log(`Report '${report.id} ${report.name}': Getting last commit of repository...`, ReportsService.name)
            const commitsResponse = await octokit.repos.listCommits({
                owner: userAccount.username,
                repo: repositoryName,
                per_page: 1,
            })
            if (commitsResponse.status !== 200) {
                report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                Logger.error(`Report '${report.id} ${repositoryName}': GitHub API returned status ${commitsResponse.status}`, ReportsService.name)
                // throw new PreconditionFailedException(`Report ${report.id} ${repositoryName}: GitHub API returned status ${commitsResponse.status}`)
                return
            }
            const sha: string = commitsResponse.data[0].sha

            Logger.log(`Downloading and extrating repository ${repositoryName}' commit '${sha}'`, ReportsService.name)
            const extractedDir = `/tmp/${uuidv4()}`
            const downloaded: boolean = await this.downloadGithubFiles(sha, extractedDir, repository, userAccount.accessToken)
            if (!downloaded) {
                report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                Logger.error(`Report '${report.id} ${repositoryName}': Could not download commit ${sha}`, ReportsService.name)
                // throw new PreconditionFailedException(`Could not download repository ${repositoryName} commit ${sha}`, ReportsService.name)
                return
            }
            Logger.log(`Report '${report.id} ${report.name}': Downloaded commit '${sha}'`, ReportsService.name)

            const filePaths: string[] = await this.getFilePaths(extractedDir)
            if (filePaths.length < 2) {
                report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                Logger.error(`Report ${report.id} ${repositoryName}: Repository does not contain any files`, ReportsService.name)
                // throw new PreconditionFailedException(`Report ${report.id} ${repositoryName}: Repository does not contain any files`, ReportsService.name)
                return
            }

            // Normalize file paths
            const relativePath: string = filePaths[1]
            const files: { name: string; filePath: string }[] = []
            let kysoConfigFile: KysoConfigFile = null
            const directoriesToRemove: string[] = []
            // Search kyso config file and annotate directories to remove at the end of the process
            for (let i = 2; i < filePaths.length; i++) {
                const filePath: string = filePaths[i]
                if (lstatSync(filePath).isDirectory()) {
                    directoriesToRemove.push(filePath)
                    continue
                }
                const fileName: string = filePath.replace(`${relativePath}/`, '')
                if (fileName === 'kyso.json') {
                    try {
                        kysoConfigFile = JSON.parse(readFileSync(filePath, 'utf8'))
                        if (!KysoConfigFile.isValid(kysoConfigFile)) {
                            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                            Logger.error(`Report ${report.id} ${repositoryName}: kyso.json config file is not valid`, ReportsService.name)
                            // throw new PreconditionFailedException(`Report ${report.id} ${repositoryName}: kyso.json config file is not valid`)
                            return
                        }
                    } catch (e) {
                        report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                        Logger.error(`Report ${report.id} ${repositoryName}: Could not parse kyso.json file`, ReportsService.name)
                        // throw new PreconditionFailedException(`Report ${report.id} ${repositoryName}: Could not parse kyso.json file`, ReportsService.name)
                        return
                    }
                } else if (fileName === 'kyso.yml' || fileName === 'kyso.yaml') {
                    try {
                        kysoConfigFile = jsYaml.load(readFileSync(filePath, 'utf8')) as KysoConfigFile
                        if (!KysoConfigFile.isValid(kysoConfigFile)) {
                            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                            Logger.error(`Report ${report.id} ${repositoryName}: kyso.{yml,yaml} config file is not valid`, ReportsService.name)
                            // throw new PreconditionFailedException(`Report ${report.id} ${repositoryName}: kyso.{yml,yaml} config file is not valid`)
                            return
                        }
                    } catch (e) {
                        report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                        Logger.error(`Report ${report.id} ${repositoryName}: Could not parse kyso.{yml,yaml} file`, ReportsService.name)
                        // throw new PreconditionFailedException(`Report ${report.id} ${repositoryName}: Could not parse kyso.{yml,yaml} file`, ReportsService.name)
                        return
                    }
                }
                files.push({ name: fileName, filePath: filePath })
            }
            if (!kysoConfigFile) {
                report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                Logger.error(`Report ${report.id} ${repositoryName}: Repository does not contain a kyso.{json,yml,yaml} config file`, ReportsService.name)
                // throw new PreconditionFailedException(`Repository ${repositoryName} does not contain a kyso.{json,yml,yaml} config file`, ReportsService.name)
                return
            }
            Logger.log(`Downloaded ${files.length} files from repository ${repositoryName}' commit '${sha}'`, ReportsService.name)

            const team: Team = await this.teamsService.getTeam({ filter: { name: kysoConfigFile.team } })
            if (!team) {
                report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                Logger.error(`Report ${report.id} ${repositoryName}: Team ${kysoConfigFile.team} does not exist`, ReportsService.name)
                // throw new PreconditionFailedException(`Report ${report.id} ${repositoryName}: Team ${kysoConfigFile.team} does not exist`)
                return
            }
            const belongsToTeam: boolean = await this.teamsService.userBelongsToTeam(team.id, user.id)
            if (!isGlobalAdmin && !belongsToTeam) {
                report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                Logger.error(`Report ${report.id} ${repositoryName}: User ${user.nickname} is not a member of team ${team.name}`, ReportsService.name)
                // throw new PreconditionFailedException(`Report ${report.id} ${repositoryName}: User ${user.nickname} is not a member of team ${team.name}`)
                return
            }

            report = await this.provider.update(
                { _id: this.provider.toObjectId(report.id) },
                {
                    $set: {
                        status: ReportStatus.Imported,
                        team_id: team.id,
                        title: kysoConfigFile.title || report.title,
                    },
                },
            )

            await this.checkReportTags(report.id, kysoConfigFile.tags)

            const s3Client: S3Client = this.getS3Client()

            // Get all report files
            reportFiles = await this.filesMongoProvider.read({ filter: { report_id: report.id }, sort: { version: -1 } })
            for (let i = 0; i < files.length; i++) {
                const originalName: string = files[i].name
                const sha: string = sha256File(files[i].filePath)
                const size: number = statSync(files[i].filePath).size
                const path_s3 = `${uuidv4()}_${sha}_${originalName}.zip`
                let reportFile: File = reportFiles.find((reportFile: File) => reportFile.name === originalName)
                if (reportFile) {
                    reportFile = new File(report.id, originalName, path_s3, size, sha, reportFile.version + 1)
                    Logger.log(`Report '${report.name}': file ${reportFile.name} new version ${reportFile.version}`, ReportsService.name)
                } else {
                    reportFile = new File(report.id, originalName, path_s3, size, sha, 1)
                    Logger.log(`Report '${report.name}': new file ${reportFile.name}`, ReportsService.name)
                }
                reportFile = await this.filesMongoProvider.create(reportFile)
                reportFiles.push(reportFile)
                const zip = new AdmZip()
                const fileContent: Buffer = readFileSync(files[i].filePath)
                zip.addFile(originalName, fileContent)
                const outputFilePath = `/tmp/${uuidv4()}.zip`
                zip.writeZip(outputFilePath)
                Logger.log(`Report '${report.name}': uploading file '${reportFile.name}' to S3...`, ReportsService.name)
                await s3Client.send(
                    new PutObjectCommand({
                        Bucket: process.env.AWS_S3_BUCKET,
                        Key: reportFile.path_s3,
                        Body: readFileSync(outputFilePath),
                    }),
                )
                Logger.log(`Report '${report.name}': uploaded file '${reportFile.name}' to S3 with key '${reportFile.path_s3}'`, ReportsService.name)
                // Delete zip file
                unlinkSync(outputFilePath)
            }

            // Delete directories
            for (let i = 0; i < directoriesToRemove.length; i++) {
                rmSync(directoriesToRemove[i], { recursive: true, force: true })
            }
            // Delete extracted directory of github project
            rmSync(extractedDir, { recursive: true, force: true })

            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Imported } })
            Logger.log(`Report '${report.id} ${report.name}' imported`, ReportsService.name)
        })

        return report
    }

    public async downloadGithubRepo(report: Report, repository: any, sha: string, userAccount: UserAccount): Promise<void> {
        Logger.log(`Downloading and extrating repository ${report.name}' commit '${sha}'`, ReportsService.name)
        report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Processing } })

        const extractedDir = `/tmp/${uuidv4()}`
        const downloaded: boolean = await this.downloadGithubFiles(sha, extractedDir, repository, userAccount.accessToken)
        if (!downloaded) {
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
            Logger.error(`Report '${report.id} ${report.name}': Could not download commit ${sha}`, ReportsService.name)
            // throw new PreconditionFailedException(`Could not download repository ${report.name} commit ${sha}`, ReportsService.name)
            return
        }
        Logger.log(`Report '${report.id} ${report.name}': Downloaded commit '${sha}'`, ReportsService.name)

        const filePaths: string[] = await this.getFilePaths(extractedDir)
        if (filePaths.length < 2) {
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
            Logger.error(`Report ${report.id} ${report.name}: Repository does not contain any files`, ReportsService.name)
            // throw new PreconditionFailedException(`Report ${report.id} ${report.name}: Repository does not contain any files`, ReportsService.name)
            return
        }

        // Normalize file paths
        const relativePath: string = filePaths[1]
        const files: { name: string; filePath: string }[] = []
        let kysoConfigFile: KysoConfigFile = null
        const directoriesToRemove: string[] = []
        // Search kyso config file and annotate directories to remove at the end of the process
        for (let i = 2; i < filePaths.length; i++) {
            const filePath: string = filePaths[i]
            if (lstatSync(filePath).isDirectory()) {
                directoriesToRemove.push(filePath)
                continue
            }
            const fileName: string = filePath.replace(`${relativePath}/`, '')
            if (fileName === 'kyso.json') {
                try {
                    kysoConfigFile = JSON.parse(readFileSync(filePath, 'utf8'))
                    if (!KysoConfigFile.isValid(kysoConfigFile)) {
                        report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                        Logger.error(`Report ${report.id} ${report.name}: kyso.json config file is not valid`, ReportsService.name)
                        // throw new PreconditionFailedException(`Report ${report.id} ${report.name}: kyso.json config file is not valid`)
                        return
                    }
                } catch (e) {
                    report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                    Logger.error(`Report ${report.id} ${report.name}: Could not parse kyso.json file`, ReportsService.name)
                    // throw new PreconditionFailedException(`Report ${report.id} ${report.name}: Could not parse kyso.json file`, ReportsService.name)
                    return
                }
            } else if (fileName === 'kyso.yml' || fileName === 'kyso.yaml') {
                try {
                    kysoConfigFile = jsYaml.load(readFileSync(filePath, 'utf8')) as KysoConfigFile
                    if (!KysoConfigFile.isValid(kysoConfigFile)) {
                        report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                        Logger.error(`Report ${report.id} ${report.name}: kyso.{yml,yaml} config file is not valid`, ReportsService.name)
                        // throw new PreconditionFailedException(`Report ${report.id} ${report.name}: kyso.{yml,yaml} config file is not valid`)
                        return
                    }
                } catch (e) {
                    report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                    Logger.error(`Report ${report.id} ${report.name}: Could not parse kyso.{yml,yaml} file`, ReportsService.name)
                    // throw new PreconditionFailedException(`Report ${report.id} ${report.name}: Could not parse kyso.{yml,yaml} file`, ReportsService.name)
                    return
                }
            }
            files.push({ name: fileName, filePath: filePath })
        }
        if (!kysoConfigFile) {
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
            Logger.error(`Report ${report.id} ${report.name}: Repository does not contain a kyso.{json,yml,yaml} config file`, ReportsService.name)
            // throw new PreconditionFailedException(`Repository ${report.name} does not contain a kyso.{json,yml,yaml} config file`, ReportsService.name)
            return
        }
        Logger.log(`Downloaded ${files.length} files from repository ${report.name}' commit '${sha}'`, ReportsService.name)

        const s3Client: S3Client = this.getS3Client()

        // Get all report files
        const reportFiles: File[] = await this.filesMongoProvider.read({ filter: { report_id: report.id }, sort: { version: -1 } })
        for (let i = 0; i < files.length; i++) {
            const originalName: string = files[i].name
            const sha: string = sha256File(files[i].filePath)
            const size: number = statSync(files[i].filePath).size
            const path_s3 = `${uuidv4()}_${sha}_${originalName}.zip`
            let reportFile: File = reportFiles.find((reportFile: File) => reportFile.name === originalName)
            if (reportFile) {
                reportFile = new File(report.id, originalName, path_s3, size, sha, reportFile.version + 1)
                Logger.log(`Report '${report.name}': file ${reportFile.name} new version ${reportFile.version}`, ReportsService.name)
            } else {
                reportFile = new File(report.id, originalName, path_s3, size, sha, 1)
                Logger.log(`Report '${report.name}': new file ${reportFile.name}`, ReportsService.name)
            }
            reportFile = await this.filesMongoProvider.create(reportFile)
            reportFiles.push(reportFile)
            const zip = new AdmZip()
            const fileContent: Buffer = readFileSync(files[i].filePath)
            zip.addFile(originalName, fileContent)
            const outputFilePath = `/tmp/${uuidv4()}.zip`
            zip.writeZip(outputFilePath)
            Logger.log(`Report '${report.name}': uploading file '${reportFile.name}' to S3...`, ReportsService.name)
            await s3Client.send(
                new PutObjectCommand({
                    Bucket: process.env.AWS_S3_BUCKET,
                    Key: reportFile.path_s3,
                    Body: readFileSync(outputFilePath),
                }),
            )
            Logger.log(`Report '${report.name}': uploaded file '${reportFile.name}' to S3 with key '${reportFile.path_s3}'`, ReportsService.name)
            // Delete zip file
            unlinkSync(outputFilePath)
        }

        // Delete directories
        for (let i = 0; i < directoriesToRemove.length; i++) {
            rmSync(directoriesToRemove[i], { recursive: true, force: true })
        }
        // Delete extracted directory of github project
        rmSync(extractedDir, { recursive: true, force: true })

        report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Imported } })
        Logger.log(`Report '${report.id} ${report.name} ${sha}' imported`, ReportsService.name)
        return
    }

    private async createWebhook(octokit: Octokit, username: string, repositoryName: string) {
        try {
            let hookUrl = `${process.env.BASE_URL}/v1/hooks/github`
            if (process.env.NODE_ENV === 'development') {
                hookUrl = 'https://smee.io/kyso-github-hook-test'
            }
            const githubWeekHooks = await octokit.repos.listWebhooks({
                owner: username,
                repo: repositoryName,
            })
            // Check if hook already exists
            let githubWebHook = githubWeekHooks.data.find((element) => element.config.url === hookUrl)
            if (!githubWebHook) {
                // Create hook
                const resultCreateWebHook = await octokit.repos.createWebhook({
                    owner: username,
                    repo: repositoryName,
                    name: 'web',
                    config: {
                        url: hookUrl,
                        content_type: 'json',
                    },
                    events: ['push'],
                    active: true,
                })
                githubWebHook = resultCreateWebHook.data
                Logger.log(`Hook created for repository ${repositoryName}'`, ReportsService.name)
            } else {
                Logger.log(`Hook already exists for repository '${repositoryName}'`, ReportsService.name)
            }
            return githubWebHook
        } catch (e) {
            Logger.error(`Error creating webhook por repository: '${repositoryName}'`, e, ReportsService.name)
            return null
        }
    }

    private async downloadGithubFiles(commit: string, extractedDir: string, repository: any, accessToken: string): Promise<boolean> {
        try {
            const zipUrl: string = repository.archive_url.replace('{archive_format}{/ref}', `zipball/${commit}`)
            const response: AxiosResponse<any> = await axios.get(zipUrl, {
                headers: {
                    Authorization: `token ${accessToken}`,
                },
                responseType: 'arraybuffer',
            })
            const zip = new AdmZip(response.data)
            zip.extractAllTo(extractedDir, true)
            return true
        } catch (e) {
            Logger.error(`An error occurred downloading github files`, e, ReportsService.name)
            return false
        }
    }

    private async getFilePaths(extractedDir: string): Promise<string[]> {
        return new Promise<string[]>((resolve, reject) => {
            glob(`${extractedDir}/**`, { dot: true }, (err: Error, files: string[]) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(files)
                }
            })
        })
    }

    private async checkReportTags(reportId: string, tags: string[]): Promise<Tag[]> {
        const reportTags: Tag[] = []
        await this.tagsService.removeTagRelationsOfEntity(reportId)
        if (!tags || tags.length === 0) {
            return reportTags
        }
        // Normalize tags
        const normalizedTags: string[] = tags.map((tag: string) => tag.trim().toLocaleLowerCase())
        const tagsDb: Tag[] = await this.tagsService.getTags({ filter: { name: { $in: normalizedTags } } })
        for (const tagName of normalizedTags) {
            let tag: Tag = tagsDb.find((tag: Tag) => tag.name === tagName)
            if (!tag) {
                // Create tag
                tag = new Tag(tagName)
                tag = await this.tagsService.createTag(tag)
            }
            await this.tagsService.assignTagToEntity(tag.id, reportId, EntityEnum.REPORT)
            reportTags.push(tag)
        }
        return reportTags
    }

    private streamToBuffer(stream: Readable): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks = []
            stream.on('data', (chunk: any) => chunks.push(chunk))
            stream.on('error', reject)
            stream.on('end', () => resolve(Buffer.concat(chunks)))
        })
    }

    public async pullReport(token: Token, reportName: string, teamName: string, response: any): Promise<void> {
        let isGlobalAdmin = false
        if (token.permissions.global?.includes(GlobalPermissionsEnum.GLOBAL_ADMIN)) {
            isGlobalAdmin = true
        }

        const team: Team = await this.teamsService.getTeam({ filter: { name: teamName } })
        if (!team) {
            response.status(404).send(`Team '${teamName}' not found`)
            return
        }

        const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id)
        const index: number = teams.findIndex((t: Team) => t.id === team.id)
        if (!isGlobalAdmin && index === -1) {
            response.status(401).send(`User does not have permission to pull report ${reportName}`)
            return
        }

        const reports: Report[] = await this.provider.read({ filter: { name: reportName, team_id: team.id } })
        if (reports.length === 0) {
            response.status(404).send(`Report ${reportName} of team ${teamName} not found`)
            return
        }
        const report: Report = reports[0]

        let reportFiles: File[] = await this.filesMongoProvider.read({ filter: { report_id: report.id } })
        // Download only the last version of each file
        const map: Map<string, File> = new Map<string, File>()
        for (const file of reportFiles) {
            if (!map.has(file.name)) {
                map.set(file.name, file)
            }
            if (map.get(file.name).version < file.version) {
                map.set(file.name, file)
            }
        }
        reportFiles = Array.from(map.values())

        const s3Client: S3Client = this.getS3Client()

        const zip: AdmZip = new AdmZip()
        Logger.log(`Report '${report.name}': downloading ${reportFiles.length} files from S3...`, ReportsService.name)
        for (const reportFile of reportFiles) {
            try {
                Logger.log(`Report '${report.name}': downloading file ${reportFile.name}...`, ReportsService.name)
                const getObjectCommand: GetObjectCommand = new GetObjectCommand({
                    Bucket: process.env.AWS_S3_BUCKET,
                    Key: reportFile.path_s3,
                })
                const result = await s3Client.send(getObjectCommand)
                if (!result || !result.hasOwnProperty('Body') || result.Body == null) {
                    Logger.error(`Error downloading file '${reportFile.name}' from S3`, ReportsService.name)
                    continue
                }
                const buffer: Buffer = await this.streamToBuffer(result.Body as Readable)
                const reportFileZip: AdmZip = new AdmZip(buffer)
                const zipEntries: AdmZip.IZipEntry[] = reportFileZip.getEntries()
                for (const zipEntry of zipEntries) {
                    Logger.log(`Report '${report.name}': adding file '${zipEntry.entryName}' to zip...`, ReportsService.name)
                    zip.addFile(zipEntry.entryName, reportFileZip.readFile(zipEntry))
                }
            } catch (e) {
                Logger.error(`An error occurred downloading file '${reportFile.name}' from S3`, e, ReportsService.name)
            }
        }

        response.set('Content-Disposition', `attachment; filename=${report.id}.zip`)
        response.set('Content-Type', 'application/zip')
        response.send(zip.toBuffer())
    }

    private async getKysoReportTree(reportId: string, path: string): Promise<GithubFileHash[]> {
        let reportFiles: File[] = await this.filesMongoProvider.read({
            filter: {
                report_id: reportId,
            },
            sort: { version: 1 },
        })

        let sanitizedPath = ''
        if (path && (path == './' || path == '/' || path == '.' || path == '/.')) {
            sanitizedPath = ''
        } else if (path && path.length) {
            sanitizedPath = path.replace('./', '').replace(/\/$/, '')
        }

        // Get last version of each file
        const map: Map<string, File> = new Map<string, File>()
        for (const reportFile of reportFiles) {
            map.set(reportFile.name, reportFile)
        }

        reportFiles = Array.from(map.values())
        let filesInPath: any[] = [...reportFiles]

        if (sanitizedPath !== '') {
            // Get the files that are in the path
            reportFiles = reportFiles.filter((file: File) => file.name.startsWith(sanitizedPath + '/'))
            filesInPath = reportFiles.map((file: File) => {
                return {
                    ...file,
                    name: file.name.replace(sanitizedPath + '/', ''),
                }
            })
        }

        let result = []
        const level = { result }

        filesInPath.forEach((file: File) => {
            file.name.split('/').reduce((r, name: string) => {
                if (!r[name]) {
                    r[name] = { result: [] }
                    r.result.push({ name, id: file.id, children: r[name].result })
                }
                return r[name]
            }, level)
        })

        if (result.length === 0) {
            const justFile = Array.from(map.values()).find((file: File) => file.name.startsWith(sanitizedPath))

            return [
                {
                    type: 'file',
                    path: justFile.name.replace(`${sanitizedPath}/`, ''),
                    hash: justFile.sha,
                    htmlUrl: '',
                },
            ]
        }

        if (result.length === 1 && result[0].name === path) {
            // We are inside a directory
            result = result[0].children
        }

        const tree: GithubFileHash[] = []
        result.forEach((element: any) => {
            const file: File = reportFiles.find((f: File) => f.id === element.id)
            if (element.children.length > 0) {
                // Directory
                tree.push({
                    type: 'dir',
                    path: element.name,
                    hash: file.sha,
                    htmlUrl: '',
                })
            } else {
                // File
                tree.push({
                    type: 'file',
                    path: file.name.replace(`${sanitizedPath}/`, ''),
                    hash: file.sha,
                    htmlUrl: '',
                })
            }
        })
        return tree
    }

    private async getKysoFileContent(reportId: string, hash: string): Promise<Buffer> {
        const files: File[] = await this.filesMongoProvider.read({
            filter: {
                report_id: reportId,
                sha: hash,
            },
        })
        if (files.length === 0) {
            return null
        }
        const reportFile: File = files[0]

        const s3Client: S3Client = this.getS3Client()
        const getObjectCommand: GetObjectCommand = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: reportFile.path_s3,
        })
        const result = await s3Client.send(getObjectCommand)
        if (!result || !result.hasOwnProperty('Body') || result.Body == null) {
            Logger.error(`Error downloading file '${reportFile.name}' from S3`, ReportsService.name)
            return null
        }
        // return this.streamToBuffer(result.Body as Readable)
        const buffer: Buffer = await this.streamToBuffer(result.Body as Readable)
        const reportFileZip: AdmZip = new AdmZip(buffer)
        const zipEntries: AdmZip.IZipEntry[] = reportFileZip.getEntries()
        if (zipEntries.length === 0) {
            return null
        }
        return zipEntries[0].getData()
    }

    public async setPreviewPicture(reportId: string, file: any): Promise<Report> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('Report not found')
        }
        const s3Client: S3Client = this.getS3Client()
        if (report?.preview_picture && report.preview_picture.length > 0) {
            Logger.log(`Removing previous image of report ${report.name}`, ReportsService.name)
            const deleteObjectCommand: DeleteObjectCommand = new DeleteObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET,
                Key: report.preview_picture.split('/').slice(-1)[0],
            })
            await s3Client.send(deleteObjectCommand)
        }
        Logger.log(`Uploading image for report ${report.name}`, ReportsService.name)
        const Key = `${uuidv4()}${extname(file.originalname)}`
        await s3Client.send(
            new PutObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET,
                Key,
                Body: file.buffer,
            }),
        )
        Logger.log(`Uploaded image for report ${report.name}`, ReportsService.name)
        const preview_picture = `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${Key}`
        return this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { preview_picture } })
    }

    public async deletePreviewPicture(reportId: string): Promise<Report> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('Report not found')
        }
        const s3Client: S3Client = this.getS3Client()
        if (report?.preview_picture && report.preview_picture.length > 0) {
            Logger.log(`Removing previous image of report ${report.name}`, OrganizationsService.name)
            const deleteObjectCommand: DeleteObjectCommand = new DeleteObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET,
                Key: report.preview_picture.split('/').slice(-1)[0],
            })
            await s3Client.send(deleteObjectCommand)
        }
        return this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { preview_picture: null } })
    }
}
