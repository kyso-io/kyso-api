import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import {
    Comment,
    CreateReportDTO,
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
    ReportPermissionsEnum,
    ReportStatus,
    RepositoryProvider,
    ResourcePermissions,
    StarredReport,
    Tag,
    Team,
    Token,
    TokenPermissions,
    UpdateReportRequestDTO,
    User,
    UserAccount,
} from '@kyso-io/kyso-model'
import { EntityEnum } from '@kyso-io/kyso-model/dist/enums/entity.enum'
import { MailerService } from '@nestjs-modules/mailer'
import { ForbiddenException, Injectable, Logger, NotFoundException, PreconditionFailedException, Provider } from '@nestjs/common'
import { Octokit } from '@octokit/rest'
import * as AdmZip from 'adm-zip'
import axios, { AxiosResponse } from 'axios'
import { lstatSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { moveSync } from 'fs-extra'
import * as glob from 'glob'
import * as jsYaml from 'js-yaml'
import { extname, join } from 'path'
import * as sha256File from 'sha256-file'
import * as Client from 'ssh2-sftp-client'
import { Readable } from 'stream'
import { v4 as uuidv4 } from 'uuid'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { NotFoundError } from '../../helpers/errorHandling'
import slugify from '../../helpers/slugify'
import { Validators } from '../../helpers/validators'
import { AuthService } from '../auth/auth.service'
import { PlatformRoleService } from '../auth/platform-role.service'
import { UserRoleService } from '../auth/user-role.service'
import { BitbucketReposService } from '../bitbucket-repos/bitbucket-repos.service'
import { CommentsService } from '../comments/comments.service'
import { GithubReposService } from '../github-repos/github-repos.service'
import { GitlabReposService } from '../gitlab-repos/gitlab-repos.service'
import { GitlabAccessToken } from '../gitlab-repos/interfaces/gitlab-access-token'
import { GitlabWeebHook } from '../gitlab-repos/interfaces/gitlab-webhook'
import { KysoSettingsEnum } from '../kyso-settings/enums/kyso-settings.enum'
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { TagsService } from '../tags/tags.service'
import { TeamsService } from '../teams/teams.service'
import { UsersService } from '../users/users.service'
import { LocalReportsService } from './local-reports.service'
import { FilesMongoProvider } from './providers/mongo-files.provider'
import { PinnedReportsMongoProvider } from './providers/mongo-pinned-reports.provider'
import { ReportsMongoProvider } from './providers/mongo-reports.provider'
import { StarredReportsMongoProvider } from './providers/mongo-starred-reports.provider'
import { SftpService } from './sftp.service'

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

    @Autowired({ typeName: 'BitbucketReposService' })
    private bitbucketReposService: BitbucketReposService

    @Autowired({ typeName: 'GitlabReposService' })
    private gitlabReposService: GitlabReposService

    @Autowired({ typeName: 'UserRoleService' })
    public userRoleService: UserRoleService

    @Autowired({ typeName: 'PlatformRoleService' })
    public platformRoleService: PlatformRoleService

    @Autowired({ typeName: 'KysoSettingsService' })
    private kysoSettingsService: KysoSettingsService

    constructor(
        private readonly mailerService: MailerService,
        private readonly provider: ReportsMongoProvider,
        private readonly pinnedReportsMongoProvider: PinnedReportsMongoProvider,
        private readonly starredReportsMongoProvider: StarredReportsMongoProvider,
        private readonly filesMongoProvider: FilesMongoProvider,
        private readonly sftpService: SftpService,
    ) {
        super()
    }

    private async getS3Client(): Promise<S3Client> {
        const awsRegion = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_REGION)
        const awsAccessKey = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_ACCESS_KEY_ID)
        const awsSecretAccessKey = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_SECRET_ACCESS_KEY)

        return new S3Client({
            region: awsRegion,
            credentials: {
                accessKeyId: awsAccessKey,
                secretAccessKey: awsSecretAccessKey,
            },
        })
    }

    public async getReports(query): Promise<Report[]> {
        return this.provider.read(query)
    }

    async getReport(query: any): Promise<Report> {
        const reports: Report[] = await this.provider.read(query)
        if (reports.length === 0) {
            return null
        }
        return reports[0]
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
        Logger.log(`Fetched team ${team.sluglified_name}`)

        if (!team) {
            Logger.error("The specified team couldn't be found")
            throw new PreconditionFailedException("The specified team couldn't be found")
        }

        createReportDto.name = slugify(createReportDto.name)

        // Check if exists a report with this name
        const reports: Report[] = await this.getReports({
            filter: {
                sluglified_name: createReportDto.name,
                team_id: team.id,
            },
        })

        if (reports.length > 0) {
            Logger.error(`A report with name ${createReportDto.name} already exists in this team. Please choose another name`)
            throw new PreconditionFailedException({
                message: `A report with name ${createReportDto.name} already exists in this team. Please choose another name`,
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
            createReportDto.name,
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
            false,
            false,
            kysoConfigFile && kysoConfigFile.main ? kysoConfigFile.main : null,
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
        if (updateReportRequestDTO?.tags) {
            await this.checkReportTags(report.id, updateReportRequestDTO.tags || [])
            delete updateReportRequestDTO.tags
        }
        return this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { ...updateReportRequestDTO, author_ids } })
    }

    public async deleteReport(reportId: string): Promise<Report> {
        const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)

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

        const s3Client: S3Client = await this.getS3Client()

        // Delete report files in S3
        const reportFiles: File[] = await this.filesMongoProvider.read({ filter: { report_id: report.id } })
        for (const file of reportFiles) {
            if (file?.path_s3 && file.path_s3.length > 0) {
                Logger.log(`Report '${report.sluglified_name}': deleting file ${file.name} in S3...`, ReportsService.name)
                const deleteObjectCommand: DeleteObjectCommand = new DeleteObjectCommand({
                    Bucket: s3Bucket,
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
        const user: User = await this.usersService.getUserById(userId)
        let userAccount: UserAccount = null
        switch (report.provider) {
            case RepositoryProvider.KYSO:
            case RepositoryProvider.KYSO_CLI:
                return this.localReportsService.getReportVersions(report.id)
            case RepositoryProvider.GITHUB:
                userAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.GITHUB)
                if (!userAccount) {
                    throw new PreconditionFailedException('User does not have a github account')
                }
                return this.githubReposService.getBranches(userAccount.accessToken, userAccount.username, report.name_provider)
            case RepositoryProvider.BITBUCKET:
                userAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.BITBUCKET)
                if (!userAccount) {
                    throw new PreconditionFailedException('User does not have a bitbucket account')
                }
                return this.bitbucketReposService.getBranches(userAccount.accessToken, report.name_provider)
            case RepositoryProvider.GITLAB:
                userAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.GITLAB)
                if (!userAccount) {
                    throw new PreconditionFailedException('User does not have a gitlab account')
                }
                const gitlabAccessToken: GitlabAccessToken = await this.gitlabReposService.checkAccessTokenValidity(userAccount)
                if (gitlabAccessToken.access_token !== userAccount.accessToken) {
                    userAccount = await this.usersService.updateGitlabUserAccount(user.id, userAccount, gitlabAccessToken)
                }
                return this.gitlabReposService.getBranches(userAccount.accessToken, parseInt(report.provider_id, 10))
            default:
                return []
        }
    }

    public async getCommits(userId: string, reportId: string, branch: string): Promise<GithubCommit[]> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('The specified report could not be found')
        }
        const user: User = await this.usersService.getUserById(userId)
        let userAccount: UserAccount = null
        switch (report.provider) {
            case RepositoryProvider.KYSO:
            case RepositoryProvider.KYSO_CLI:
                throw new PreconditionFailedException({
                    message: 'This functionality is not available in S3',
                })
            case RepositoryProvider.GITHUB:
                userAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.GITHUB)
                if (!userAccount) {
                    throw new PreconditionFailedException('User does not have a github account')
                }
                return this.githubReposService.getCommits(userAccount.accessToken, userAccount.username, report.name_provider, branch)
            case RepositoryProvider.BITBUCKET:
                userAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.BITBUCKET)
                if (!userAccount) {
                    throw new PreconditionFailedException('User does not have a bitbucket account')
                }
                return this.bitbucketReposService.getCommits(userAccount.accessToken, report.name_provider, branch)
        }
    }

    public async getReportTree(
        userId: string,
        reportId: string,
        branch: string,
        path: string,
        version: number | null,
    ): Promise<GithubFileHash | GithubFileHash[]> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new NotFoundError({ message: 'The specified report could not be found' })
        }
        const user: User = await this.usersService.getUserById(userId)
        let userAccount: UserAccount = null
        switch (report.provider) {
            case RepositoryProvider.KYSO:
            case RepositoryProvider.KYSO_CLI:
                return this.getKysoReportTree(report.id, path, version)
            case RepositoryProvider.GITHUB:
                userAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.GITHUB)
                if (!userAccount) {
                    throw new PreconditionFailedException('User does not have a github account')
                }
                return this.githubReposService.getFileHash(userAccount.accessToken, path, userAccount.username, report.name_provider, branch)
            case RepositoryProvider.BITBUCKET:
                userAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.BITBUCKET)
                if (!userAccount) {
                    throw new PreconditionFailedException('User does not have a bitbucket account')
                }
                const result = await this.bitbucketReposService.getRootFilesAndFoldersByCommit(
                    userAccount.accessToken,
                    report.name_provider,
                    branch,
                    path,
                    null,
                )
                return result?.data ? result.data : []
            case RepositoryProvider.GITLAB:
                userAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.GITLAB)
                if (!userAccount) {
                    throw new PreconditionFailedException('User does not have a gitlab account')
                }
                const gitlabAccessToken: GitlabAccessToken = await this.gitlabReposService.checkAccessTokenValidity(userAccount)
                if (gitlabAccessToken.access_token !== userAccount.accessToken) {
                    userAccount = await this.usersService.updateGitlabUserAccount(user.id, userAccount, gitlabAccessToken)
                }
                return this.gitlabReposService.getRepositoryTree(gitlabAccessToken.access_token, parseInt(report.provider_id, 10), branch, path, false)
            default:
                return null
        }
    }

    public async getReportFileContent(userId: string, reportId: string, hash: string, filePath: string): Promise<Buffer> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('The specified report could not be found')
        }
        const user: User = await this.usersService.getUserById(userId)
        let userAccount: UserAccount = null
        switch (report.provider) {
            case RepositoryProvider.KYSO:
            case RepositoryProvider.KYSO_CLI:
            case RepositoryProvider.GITLAB:
                return this.getKysoFileContent(report.id, hash)
            case RepositoryProvider.GITHUB:
                userAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.GITHUB)
                if (!userAccount) {
                    throw new PreconditionFailedException('User does not have a github account')
                }
                return this.githubReposService.getFileContent(userAccount.accessToken, hash, userAccount.username, report.name_provider)
            case RepositoryProvider.BITBUCKET:
                userAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.BITBUCKET)
                if (!userAccount) {
                    throw new PreconditionFailedException('User does not have a bitbucket account')
                }
                return this.bitbucketReposService.getFileContent(userAccount.accessToken, report.name_provider, hash, filePath)
            case RepositoryProvider.GITLAB:
                userAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.GITLAB)
                if (!userAccount) {
                    throw new PreconditionFailedException('User does not have a gitlab account')
                }
                const gitlabAccessToken: GitlabAccessToken = await this.gitlabReposService.checkAccessTokenValidity(userAccount)
                if (gitlabAccessToken.access_token !== userAccount.accessToken) {
                    userAccount = await this.usersService.updateGitlabUserAccount(user.id, userAccount, gitlabAccessToken)
                }
                return this.gitlabReposService.getFileContent(userAccount.accessToken, parseInt(report.provider_id, 10), filePath, hash)
            default:
                return null
        }
    }

    public async toggleGlobalPin(reportId: string): Promise<Report> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new NotFoundError({ message: 'The specified report could not be found' })
        }
        return this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { pin: !report.pin } })
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
        let pinnedReport: StarredReport[] = []
        if (userId) {
            pinnedReport = await this.pinnedReportsMongoProvider.read({
                filter: {
                    user_id: userId,
                    report_id: report.id,
                },
            })
        }
        const userPin = pinnedReport.length > 0
        const numberOfStars: number = await this.starredReportsMongoProvider.count({ filter: { report_id: report.id } })
        let starredReport: StarredReport[] = []
        if (userId) {
            starredReport = await this.starredReportsMongoProvider.read({
                filter: {
                    user_id: userId,
                    report_id: report.id,
                },
            })
        }
        const markAsStar: boolean = starredReport.length > 0
        const comments: Comment[] = await this.commentsService.getComments({ filter: { report_id: report.id } })
        const tags: Tag[] = await this.tagsService.getTagsOfEntity(report.id, EntityEnum.REPORT)

        const lastVersion: number = await this.getLastVersionOfReport(report.id)
        let mainFile: File | null = null
        if (report.main_file && report.main_file.length > 0) {
            const result = await this.filesMongoProvider.read({
                filter: {
                    report_id: report.id,
                    name: report.main_file,
                    version: lastVersion,
                },
            })
            mainFile = result.length > 0 ? result[0] : null
        }

        return new ReportDTO(
            report.id,
            report.created_at,
            report.updated_at,
            report?.links ? (report.links as any) : null,
            report.sluglified_name,
            report.report_type,
            report.views,
            report.provider,
            report.name_provider,
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
            report.show_code,
            report.show_output,
            mainFile ? mainFile.name : null,
            mainFile ? mainFile.sha : null,
            mainFile ? mainFile.path_scs : null,
            mainFile ? mainFile.version : null,
            lastVersion,
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

    public async createKysoReport(userId: string, file: Express.Multer.File): Promise<Report> {
        Logger.log('Creating report')
        const user: User = await this.usersService.getUserById(userId)
        Logger.log(`By user: ${user.email}`)
        const isGlobalAdmin: boolean = user.global_permissions.includes(GlobalPermissionsEnum.GLOBAL_ADMIN)
        Logger.log(`is global admin?: ${isGlobalAdmin}`)

        const tmpDir = `/tmp/${uuidv4()}`
        const zip = new AdmZip(file.buffer)
        zip.extractAllTo(tmpDir, true)

        let kysoConfigFile: KysoConfigFile = null
        for (const entry of zip.getEntries()) {
            const originalName: string = entry.name
            const localFilePath = join(tmpDir, entry.entryName)
            if (originalName.endsWith('kyso.json')) {
                try {
                    kysoConfigFile = JSON.parse(readFileSync(localFilePath).toString())
                    break
                } catch (e: any) {
                    Logger.error(`An error occurred parsing kyso.json`, e, ReportsService.name)
                    throw new PreconditionFailedException(`An error occurred parsing kyso.json`)
                }
            } else if (originalName.endsWith('kyso.yml') || originalName.endsWith('kyso.yaml')) {
                try {
                    kysoConfigFile = jsYaml.load(readFileSync(localFilePath).toString()) as KysoConfigFile
                    break
                } catch (e: any) {
                    Logger.error(`An error occurred parsing kyso.{yml,yaml}`, e, ReportsService.name)
                    throw new PreconditionFailedException(`An error occurred parsing kyso.{yml,yaml}`)
                }
            }
        }
        if (!kysoConfigFile) {
            Logger.error(`No kyso.{yml,yaml,json} file found`, ReportsService.name)
            throw new PreconditionFailedException(`No kyso.{yml,yaml,json} file found`)
        }

        const team: Team = await this.teamsService.getTeam({ filter: { sluglified_name: kysoConfigFile.team } })
        Logger.log(`Team: ${team.sluglified_name}`)
        if (!team) {
            Logger.error(`Team ${kysoConfigFile.team} does not exist`)
            throw new PreconditionFailedException(`Team ${kysoConfigFile.team} does not exist`)
        }
        const userHasPermission: boolean = await this.checkCreateReportPermission(userId, kysoConfigFile.team)
        if (!userHasPermission) {
            Logger.error(`User ${user.username} does not have permission to create report in team ${kysoConfigFile.team}`)
            throw new PreconditionFailedException(`User ${user.username} does not have permission to create report in team ${kysoConfigFile.team}`)
        }
        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
        let extractedDir = null

        const name: string = slugify(kysoConfigFile.title)
        const reports: Report[] = await this.provider.read({ filter: { sluglified_name: name, team_id: team.id } })
        const reportFiles: File[] = []
        let version = 1
        let report: Report = null
        const reportPath: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.REPORT_PATH)
        let isNew = false
        if (reports.length > 0) {
            // Existing report
            report = reports[0]
            const lastVersion: number = await this.getLastVersionOfReport(report.id)
            version = lastVersion + 1
            extractedDir = join(reportPath, `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}`)
            moveSync(tmpDir, extractedDir, { overwrite: true })
            Logger.log(`Report '${report.id} ${report.sluglified_name}': Checking files...`, ReportsService.name)
            for (const entry of zip.getEntries()) {
                const originalName: string = entry.entryName
                const localFilePath = join(extractedDir, entry.entryName)
                if (entry.isDirectory) {
                    continue
                }
                const sha: string = sha256File(localFilePath)
                const size: number = statSync(localFilePath).size
                const path_s3 = `${uuidv4()}_${sha}_${originalName}.zip`
                const path_scs = `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}/${entry.entryName}`
                let reportFile = new File(report.id, originalName, path_s3, path_scs, size, sha, version)
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
                name,
                null,
                null,
                null,
                0,
                false,
                kysoConfigFile.description,
                userId,
                team.id,
                kysoConfigFile.title,
                [],
                null,
                false,
                false,
                kysoConfigFile?.main,
            )
            if (kysoConfigFile?.type && kysoConfigFile.type.length > 0) {
                report.report_type = kysoConfigFile.type
            }
            report = await this.provider.create(report)
            isNew = true
            extractedDir = join(reportPath, `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}`)
            moveSync(tmpDir, extractedDir, { overwrite: true })
            for (const entry of zip.getEntries()) {
                const originalName: string = entry.entryName
                const localFilePath = join(extractedDir, entry.entryName)
                if (entry.isDirectory) {
                    continue
                }
                const sha: string = sha256File(localFilePath)
                const size: number = statSync(localFilePath).size
                const path_s3 = `${uuidv4()}_${sha}_${originalName}.zip`
                const path_scs = `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}/${entry.entryName}`
                let file: File = new File(report.id, originalName, path_s3, path_scs, size, sha, 1)
                file = await this.filesMongoProvider.create(file)
                reportFiles.push(file)
            }
            await this.checkReportTags(report.id, kysoConfigFile.tags)
        }

        let files: string[] = await this.getFilePaths(extractedDir)
        // Remove '/reportPath' from the paths
        files = files.map((file: string) => file.replace(reportPath, ''))
        writeFileSync(join(reportPath, `/${report.id}.indexer`), files.join('\n'))

        new Promise<void>(async () => {
            Logger.log(`Report '${report.id} ${report.sluglified_name}': Uploading files to Ftp...`, ReportsService.name)
            await this.uploadReportToFtp(report.id, extractedDir)

            Logger.log(`Report '${report.id} ${report.sluglified_name}': Uploading files to S3...`, ReportsService.name)
            const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)
            const s3Client: S3Client = await this.getS3Client()
            for (const entry of zip.getEntries()) {
                if (entry.isDirectory) {
                    continue
                }
                const reportFile: File = reportFiles.find((reportFile: File) => reportFile.name === entry.entryName)
                Logger.log(`Report '${report.sluglified_name}': uploading file '${reportFile.name}' to S3...`, ReportsService.name)
                const zip = new AdmZip()
                zip.addFile(entry.name, entry.getData())
                await s3Client.send(
                    new PutObjectCommand({
                        Bucket: s3Bucket,
                        Key: reportFile.path_s3,
                        Body: zip.toBuffer(),
                    }),
                )
                Logger.log(`Report '${report.sluglified_name}': uploaded file '${reportFile.name}' to S3 with key '${reportFile.path_s3}'`, ReportsService.name)
            }
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Imported } })
            Logger.log(`Report '${report.id} ${report.sluglified_name}' imported`, ReportsService.name)

            rmSync(extractedDir, { recursive: true, force: true })

            await this.sendNewReportMail(report, team, organization, isNew)
        })

        return report
    }

    public async createUIReport(userId: string, file: Express.Multer.File): Promise<Report> {
        Logger.log('Creating report')
        const user: User = await this.usersService.getUserById(userId)
        Logger.log(`By user: ${user.email}`)
        const isGlobalAdmin: boolean = user.global_permissions.includes(GlobalPermissionsEnum.GLOBAL_ADMIN)
        Logger.log(`is global admin?: ${isGlobalAdmin}`)

        const tmpDir = `/tmp/${uuidv4()}`
        const zip = new AdmZip(file.buffer)
        zip.extractAllTo(tmpDir, true)

        let kysoConfigFile: KysoConfigFile = null
        for (const entry of zip.getEntries()) {
            const originalName: string = entry.name
            const localFilePath = join(tmpDir, entry.entryName)
            if (originalName.endsWith('kyso.json')) {
                try {
                    kysoConfigFile = JSON.parse(readFileSync(localFilePath).toString())
                    break
                } catch (e: any) {
                    Logger.error(`An error occurred parsing kyso.json`, e, ReportsService.name)
                    throw new PreconditionFailedException(`An error occurred parsing kyso.json`)
                }
            } else if (originalName.endsWith('kyso.yml') || originalName.endsWith('kyso.yaml')) {
                try {
                    kysoConfigFile = jsYaml.load(readFileSync(localFilePath).toString()) as KysoConfigFile
                    break
                } catch (e: any) {
                    Logger.error(`An error occurred parsing kyso.{yml,yaml}`, e, ReportsService.name)
                    throw new PreconditionFailedException(`An error occurred parsing kyso.{yml,yaml}`)
                }
            }
        }
        if (!kysoConfigFile) {
            Logger.error(`No kyso.{yml,yaml,json} file found`, ReportsService.name)
            throw new PreconditionFailedException(`No kyso.{yml,yaml,json} file found`)
        }

        const team: Team = await this.teamsService.getTeam({ filter: { sluglified_name: kysoConfigFile.team } })
        Logger.log(`Team: ${team.sluglified_name}`)
        if (!team) {
            Logger.error(`Team ${kysoConfigFile.team} does not exist`)
            throw new PreconditionFailedException(`Team ${kysoConfigFile.team} does not exist`)
        }
        const userHasPermission: boolean = await this.checkCreateReportPermission(userId, kysoConfigFile.team)
        if (!userHasPermission) {
            Logger.error(`User ${user.username} does not have permission to create report in team ${kysoConfigFile.team}`)
            throw new PreconditionFailedException(`User ${user.username} does not have permission to create report in team ${kysoConfigFile.team}`)
        }
        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
        let extractedDir = null

        const name: string = slugify(kysoConfigFile.title)
        const reports: Report[] = await this.provider.read({ filter: { sluglified_name: name, team_id: team.id } })
        const reportFiles: File[] = []
        let report: Report = null
        const reportPath: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.REPORT_PATH)
        if (reports.length > 0) {
            Logger.log(`Report '${name}' already exists in team ${team.sluglified_name}`, ReportsService.name)
            throw new PreconditionFailedException(`Report '${name}' already exists in team ${team.sluglified_name}`)
        }
        Logger.log(`Creating new report '${name}'`, ReportsService.name)
        report = new Report(
            name,
            null,
            null,
            RepositoryProvider.KYSO,
            name,
            null,
            null,
            null,
            0,
            false,
            kysoConfigFile.description,
            userId,
            team.id,
            kysoConfigFile.title,
            [],
            null,
            false,
            false,
            kysoConfigFile.main,
        )
        if (kysoConfigFile?.type && kysoConfigFile.type.length > 0) {
            report.report_type = kysoConfigFile.type
        }
        report = await this.provider.create(report)
        const version = 1
        extractedDir = join(reportPath, `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}`)
        moveSync(tmpDir, extractedDir, { overwrite: true })
        for (const entry of zip.getEntries()) {
            const originalName: string = entry.entryName
            const localFilePath = join(extractedDir, entry.entryName)
            if (entry.isDirectory) {
                continue
            }
            const sha: string = sha256File(localFilePath)
            const size: number = statSync(localFilePath).size
            const path_s3 = `${uuidv4()}_${sha}_${originalName}.zip`
            const path_scs = `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}/${entry.entryName}`
            let file: File = new File(report.id, originalName, path_s3, path_scs, size, sha, version)
            file = await this.filesMongoProvider.create(file)
            reportFiles.push(file)
        }

        let files: string[] = await this.getFilePaths(extractedDir)
        // Remove '/reportPath' from the paths
        files = files.map((file: string) => file.replace(reportPath, ''))
        writeFileSync(join(reportPath, `/${report.id}.indexer`), files.join('\n'))

        await this.checkReportTags(report.id, kysoConfigFile.tags)

        new Promise<void>(async () => {
            Logger.log(`Report '${report.id} ${report.sluglified_name}': Uploading files to Ftp...`, ReportsService.name)
            await this.uploadReportToFtp(report.id, extractedDir)

            Logger.log(`Report '${report.id} ${report.sluglified_name}': Uploading files to S3...`, ReportsService.name)
            const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)
            const s3Client: S3Client = await this.getS3Client()
            for (const entry of zip.getEntries()) {
                if (entry.isDirectory) {
                    continue
                }
                const reportFile: File = reportFiles.find((reportFile: File) => reportFile.name === entry.entryName)
                Logger.log(`Report '${report.sluglified_name}': uploading file '${reportFile.name}' to S3...`, ReportsService.name)
                const zip = new AdmZip()
                zip.addFile(entry.name, entry.getData())
                await s3Client.send(
                    new PutObjectCommand({
                        Bucket: s3Bucket,
                        Key: reportFile.path_s3,
                        Body: zip.toBuffer(),
                    }),
                )
                Logger.log(`Report '${report.sluglified_name}': uploaded file '${reportFile.name}' to S3 with key '${reportFile.path_s3}'`, ReportsService.name)
            }
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Imported } })
            Logger.log(`Report '${report.id} ${report.sluglified_name}' imported`, ReportsService.name)

            rmSync(extractedDir, { recursive: true, force: true })

            await this.sendNewReportMail(report, team, organization, true)
        })

        return report
    }

    private async sendNewReportMail(report: Report, team: Team, organization: Organization, isNew: boolean): Promise<void> {
        const user: User = await this.usersService.getUserById(report.user_id)
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        const frontendUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL)
        const to = centralizedMails && emails.length > 0 ? emails : user.email
        this.mailerService
            .sendMail({
                to,
                subject: isNew ? `New report '${report.title}'` : `Updated report '${report.title}'`,
                template: isNew ? 'report-new' : 'report-updated',
                context: {
                    organization,
                    team,
                    report,
                    frontendUrl,
                },
            })
            .then((messageInfo) => {
                Logger.log(`Report mail ${messageInfo.messageId} sent to ${Array.isArray(to) ? to.join(', ') : to}`, ReportsService.name)
            })
            .catch((err) => {
                Logger.error(`An error occurrend sending report mail to ${Array.isArray(to) ? to.join(', ') : to}`, err, ReportsService.name)
            })
    }

    public async updateMainFileReport(userId: string, reportId: string, file: any): Promise<Report> {
        const report: Report = await this.getReport({
            filter: {
                _id: this.provider.toObjectId(reportId),
            },
        })
        if (!report) {
            throw new NotFoundException(`Report with id '${reportId}' not found`)
        }
        const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(userId)
        const team: Team | undefined = teams.find((team: Team) => team.id === report.team_id)
        if (!team) {
            throw new ForbiddenException(`User '${userId}' is not allowed to update report '${report.id}'`)
        }
        const files: File[] = await this.filesMongoProvider.read({ filter: { report_id: report.id, name: report.main_file } })
        if (files.length === 0) {
            throw new NotFoundException(`File with name '${report.main_file}' not found`)
        }
        let reportFile: File = files[0]

        const zip = new AdmZip()
        const originalName: string = reportFile.name
        zip.addFile(originalName, file.buffer)
        const localFilePath = `/tmp/${report.id}_${originalName}`
        writeFileSync(localFilePath, file.buffer)

        const lastVersion: number = await this.getLastVersionOfReport(report.id)
        const version = lastVersion + 1

        Logger.log(`Report '${report.id} ${report.sluglified_name}': Uploading main file to Ftp...`, ReportsService.name)
        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
        const client: Client = await this.sftpService.getClient()
        const sftpDestinationFolder = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_DESTINATION_FOLDER)
        const destinationPath = join(
            sftpDestinationFolder,
            `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}/${originalName}`,
        )
        const result = await client.put(localFilePath, destinationPath)
        Logger.log(result, ReportsService.name)

        const sha: string = sha256File(localFilePath)
        unlinkSync(localFilePath)
        const size: number = file.size
        const path_s3 = `${uuidv4()}_${sha}_${originalName}.zip`
        const path_scs = `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}/${originalName}`
        reportFile = new File(report.id, reportFile.name, path_s3, path_scs, size, sha, version)
        Logger.log(`Report '${report.sluglified_name}': file ${reportFile.name} new version ${reportFile.version}`, ReportsService.name)
        reportFile = await this.filesMongoProvider.create(reportFile)
        Logger.log(`Report '${report.sluglified_name}': uploading file '${reportFile.name}' to S3...`, ReportsService.name)
        const s3Client: S3Client = await this.getS3Client()
        const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)
        await s3Client.send(
            new PutObjectCommand({
                Bucket: s3Bucket,
                Key: path_s3,
                Body: zip.toBuffer(),
            }),
        )
        Logger.log(`Report '${report.sluglified_name}': uploaded file '${report.sluglified_name}' to S3 with key '${reportFile.path_s3}'`, ReportsService.name)
        return report
    }

    public async createReportFromGithubRepository(userId: string, repositoryName: string, branch: string): Promise<Report> {
        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new NotFoundError(`User ${userId} does not exist`)
        }
        const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.GITHUB)
        if (!userAccount) {
            throw new PreconditionFailedException(`User ${user.display_name} does not have a GitHub account`)
        }
        if (!userAccount.username || userAccount.username.length === 0) {
            throw new PreconditionFailedException(`User ${user.display_name} does not have a GitHub username`)
        }
        if (!userAccount.accessToken || userAccount.accessToken.length === 0) {
            throw new PreconditionFailedException(`User ${user.display_name} does not have a GitHub access token`)
        }

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

        const reports: Report[] = await this.provider.read({ filter: { sluglified_name: slugify(repository.name), user_id: user.id } })
        let report: Report = null
        let isNew = false
        if (reports.length > 0) {
            // Existing report
            report = reports[0]
            if (report.status === ReportStatus.Processing) {
                Logger.log(`Report '${report.id} ${report.sluglified_name}' is being imported`, ReportsService.name)
                return report
            }
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Processing } })
            Logger.log(`Report '${report.id} ${report.sluglified_name}' already imported. Updating files...`, ReportsService.name)
        } else {
            const webhook = await this.createGithubWebhook(octokit, userAccount.username, repository.name)
            report = new Report(
                slugify(repository.name),
                repository.id.toString(),
                webhook.id.toString(),
                RepositoryProvider.GITHUB,
                repository.name,
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
                false,
                false,
                null,
            )
            report = await this.provider.create(report)
            Logger.log(`New report '${report.id} ${report.sluglified_name}'`, ReportsService.name)
            isNew = true
        }

        new Promise<void>(async () => {
            Logger.log(`Report '${report.id} ${report.sluglified_name}': Getting last commit of repository...`, ReportsService.name)
            const args: any = {
                owner: userAccount.username,
                repo: repositoryName,
                per_page: 1,
            }
            if (branch && branch.length > 0) {
                args.sha = branch
            }
            const commitsResponse = await octokit.repos.listCommits(args)
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
            Logger.log(`Report '${report.id} ${report.sluglified_name}': Downloaded commit '${sha}'`, ReportsService.name)

            const filePaths: string[] = await this.getFilePaths(extractedDir)
            if (filePaths.length < 1) {
                report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                Logger.error(`Report ${report.id} ${repositoryName}: Repository does not contain any files`, ReportsService.name)
                // throw new PreconditionFailedException(`Report ${report.id} ${repositoryName}: Repository does not contain any files`, ReportsService.name)
                return
            }

            // Normalize file paths
            let files: { name: string; filePath: string }[] = []
            let kysoConfigFile: KysoConfigFile = null
            let directoriesToRemove: string[] = []
            try {
                const result = await this.normalizeFilePaths(report, filePaths)
                files = result.files
                kysoConfigFile = result.kysoConfigFile
                directoriesToRemove = result.directoriesToRemove
                Logger.log(`Downloaded ${files.length} files from repository ${repositoryName}' commit '${branch}'`, ReportsService.name)
            } catch (e) {
                await this.deleteReport(report.id)
                return null
            }
            Logger.log(`Downloaded ${files.length} files from repository ${repositoryName}' commit '${sha}'`, ReportsService.name)

            const userHasPermission: boolean = await this.checkCreateReportPermission(userId, kysoConfigFile.team)
            if (!userHasPermission) {
                Logger.error(`User ${user.username} does not have permission to create report in team ${kysoConfigFile.team}`)
                await this.deleteReport(report.id)
                this.mailerService
                    .sendMail({
                        to: user.email,
                        subject: 'Error creating report',
                        template: 'report-error-permissions',
                    })
                    .then(() => {
                        Logger.log(`Mail 'Invalid permissions for creating report' sent to ${user.display_name}`, UsersService.name)
                    })
                    .catch((err) => {
                        Logger.error(`Error sending mail 'Invalid permissions for creating report' to ${user.display_name}`, err, UsersService.name)
                    })
                return
            }

            await this.uploadRepositoryFilesToS3(report, extractedDir, kysoConfigFile, files, directoriesToRemove, isNew)
        })

        return report
    }

    public async downloadGithubRepo(report: Report, repository: any, sha: string, userAccount: UserAccount): Promise<void> {
        Logger.log(`Downloading and extrating repository ${report.sluglified_name}' commit '${sha}'`, ReportsService.name)
        report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Processing } })

        const extractedDir = `/tmp/${uuidv4()}`
        const downloaded: boolean = await this.downloadGithubFiles(sha, extractedDir, repository, userAccount.accessToken)
        if (!downloaded) {
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
            Logger.error(`Report '${report.id} ${report.sluglified_name}': Could not download commit ${sha}`, ReportsService.name)
            // throw new PreconditionFailedException(`Could not download repository ${report.sluglified_name} commit ${sha}`, ReportsService.name)
            return
        }
        Logger.log(`Report '${report.id} ${report.sluglified_name}': Downloaded commit '${sha}'`, ReportsService.name)

        const filePaths: string[] = await this.getFilePaths(extractedDir)
        if (filePaths.length < 2) {
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
            Logger.error(`Report ${report.id} ${report.sluglified_name}: Repository does not contain any files`, ReportsService.name)
            // throw new PreconditionFailedException(`Report ${report.id} ${report.sluglified_name}: Repository does not contain any files`, ReportsService.name)
            return
        }

        // Normalize file paths
        let files: { name: string; filePath: string }[] = []
        let kysoConfigFile: KysoConfigFile = null
        let directoriesToRemove: string[] = []
        try {
            const result = await this.normalizeFilePaths(report, filePaths)
            files = result.files
            kysoConfigFile = result.kysoConfigFile
            directoriesToRemove = result.directoriesToRemove
            Logger.log(`Downloaded ${files.length} files from repository ${report.sluglified_name}' commit '${sha}'`, ReportsService.name)
        } catch (e) {
            await this.deleteReport(report.id)
            return null
        }
        Logger.log(`Downloaded ${files.length} files from repository ${report.sluglified_name}' commit '${sha}'`, ReportsService.name)

        await this.uploadRepositoryFilesToS3(report, extractedDir, kysoConfigFile, files, directoriesToRemove, false)
    }

    public async createReportFromBitbucketRepository(userId: string, repositoryName: string, branch: string): Promise<Report> {
        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new NotFoundError(`User ${userId} does not exist`)
        }
        const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.BITBUCKET)
        if (!userAccount) {
            throw new PreconditionFailedException(`User ${user.display_name} does not have a Bitbucket account`)
        }
        if (!userAccount.username || userAccount.username.length === 0) {
            throw new PreconditionFailedException(`User ${user.display_name} does not have a Bitbucket username`)
        }
        if (!userAccount.accessToken || userAccount.accessToken.length === 0) {
            throw new PreconditionFailedException(`User ${user.display_name} does not have a Bitbucket access token`)
        }

        let bitbucketRepository: any = null
        try {
            bitbucketRepository = await this.bitbucketReposService.getRepository(userAccount.accessToken, repositoryName)
        } catch (e) {
            throw new PreconditionFailedException(`User ${user.display_name} does not have a Bitbucket repository '${repositoryName}'`)
        }

        const reports: Report[] = await this.provider.read({ filter: { sluglified_name: bitbucketRepository.name, user_id: user.id } })
        let report: Report = null
        let isNew = false
        if (reports.length > 0) {
            // Existing report
            report = reports[0]
            if (report.status === ReportStatus.Processing) {
                Logger.log(`Report '${report.id} ${report.sluglified_name}' is being imported`, ReportsService.name)
                return report
            }
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Processing } })
            Logger.log(`Report '${report.id} ${report.sluglified_name}' already imported. Updating files...`, ReportsService.name)
        } else {
            let webhook: any = null
            try {
                webhook = await this.bitbucketReposService.createWebhook(userAccount.accessToken, repositoryName)
                Logger.log(`Created webhook for repository '${repositoryName}' with id ${webhook.id}`, ReportsService.name)
            } catch (e) {
                throw Error(`An error occurred creating webhook for repository '${repositoryName}'`)
            }
            report = new Report(
                slugify(bitbucketRepository.name),
                bitbucketRepository.id,
                webhook.uuid,
                RepositoryProvider.BITBUCKET,
                bitbucketRepository.name,
                userAccount.username,
                bitbucketRepository.defaultBranch,
                null,
                0,
                false,
                bitbucketRepository.description,
                user.id,
                null,
                bitbucketRepository.name,
                [],
                null,
                false,
                false,
                null,
            )
            report = await this.provider.create(report)
            Logger.log(`New report '${report.id} ${report.sluglified_name}'`, ReportsService.name)
            isNew = true
        }

        new Promise<void>(async () => {
            const desiredCommit: string = branch && branch.length > 0 ? branch : bitbucketRepository.defaultBranch
            const extractedDir = `/tmp/${uuidv4()}`
            try {
                Logger.log(`Downloading and extrating repository ${repositoryName}' commit '${desiredCommit}'`, ReportsService.name)
                const buffer: Buffer = await this.bitbucketReposService.downloadRepository(userAccount.accessToken, repositoryName, desiredCommit)
                if (!buffer) {
                    report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                    Logger.error(`Report '${report.id} ${repositoryName}': Could not download commit ${desiredCommit}`, ReportsService.name)
                    // throw new PreconditionFailedException(`Could not download repository ${repositoryName} commit ${desiredCommit}`, ReportsService.name)
                    return
                }
                Logger.log(`Report '${report.id} ${report.sluglified_name}': Downloaded commit '${desiredCommit}'`, ReportsService.name)
                const zip: AdmZip = new AdmZip(buffer)
                zip.extractAllTo('/tmp', true)
                moveSync(`/tmp/${zip.getEntries()[0].entryName}`, extractedDir, { overwrite: true })
                Logger.log(`Extracted repository '${repositoryName}' commit '${desiredCommit}' to '${extractedDir}'`, ReportsService.name)
            } catch (e) {
                await this.deleteReport(report.id)
                throw Error(`An error occurred downloading repository '${repositoryName}'`)
            }

            const filePaths: string[] = await this.getFilePaths(extractedDir)
            if (filePaths.length < 1) {
                report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                Logger.error(`Report ${report.id} ${repositoryName}: Repository does not contain any files`, ReportsService.name)
                throw new PreconditionFailedException(`Report ${report.id} ${repositoryName}: Repository does not contain any files`, ReportsService.name)
            }

            // Normalize file paths
            let files: { name: string; filePath: string }[] = []
            let kysoConfigFile: KysoConfigFile = null
            let directoriesToRemove: string[] = []
            try {
                const result = await this.normalizeFilePaths(report, filePaths)
                files = result.files
                kysoConfigFile = result.kysoConfigFile
                directoriesToRemove = result.directoriesToRemove
                Logger.log(`Downloaded ${files.length} files from repository ${repositoryName}' commit '${desiredCommit}'`, ReportsService.name)
            } catch (e) {
                await this.deleteReport(report.id)
                return null
            }

            const userHasPermission: boolean = await this.checkCreateReportPermission(userId, kysoConfigFile.team)
            if (!userHasPermission) {
                Logger.error(`User ${user.username} does not have permission to create report in team ${kysoConfigFile.team}`)
                await this.deleteReport(report.id)
                this.mailerService
                    .sendMail({
                        to: user.email,
                        subject: 'Error creating report',
                        template: 'report-error-permissions',
                    })
                    .then(() => {
                        Logger.log(`Mail 'Invalid permissions for creating report' sent to ${user.display_name}`, UsersService.name)
                    })
                    .catch((err) => {
                        Logger.error(`Error sending mail 'Invalid permissions for creating report' to ${user.display_name}`, err, UsersService.name)
                    })
                return
            }

            await this.uploadRepositoryFilesToS3(report, extractedDir, kysoConfigFile, files, directoriesToRemove, isNew)
        })

        return report
    }

    public async createReportFromGitlabRepository(userId: string, repositoryId: number | string, branch: string): Promise<Report> {
        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new NotFoundError(`User ${userId} does not exist`)
        }
        const userAccount: UserAccount = user.accounts.find((account: UserAccount) => account.type === LoginProviderEnum.GITLAB)
        if (!userAccount) {
            throw new PreconditionFailedException(`User ${user.display_name} does not have a Gitlab account`)
        }
        if (!userAccount.username || userAccount.username.length === 0) {
            throw new PreconditionFailedException(`User ${user.display_name} does not have a Gitlab username`)
        }
        if (!userAccount.accessToken || userAccount.accessToken.length === 0) {
            throw new PreconditionFailedException(`User ${user.display_name} does not have a Gitlab access token`)
        }

        let gitlabRepository: GithubRepository = null
        try {
            gitlabRepository = await this.gitlabReposService.getRepository(userAccount.accessToken, repositoryId)
        } catch (e) {
            throw new PreconditionFailedException(`User ${user.display_name} does not have a Gitlab repository '${repositoryId}'`)
        }

        const reports: Report[] = await this.provider.read({ filter: { sluglified_name: gitlabRepository.name, user_id: user.id } })
        let report: Report = null
        let isNew = false
        if (reports.length > 0) {
            // Existing report
            report = reports[0]
            if (report.status === ReportStatus.Processing) {
                Logger.log(`Report '${report.id} ${report.sluglified_name}' is being imported`, ReportsService.name)
                return report
            }
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Processing } })
            Logger.log(`Report '${report.id} ${report.sluglified_name}' already imported. Updating files...`, ReportsService.name)
        } else {
            let webhook: GitlabWeebHook = null
            try {
                const baseUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.BASE_URL)
                let hookUrl = `${baseUrl}/v1/hooks/gitlab`
                if (process.env.NODE_ENV === 'development') {
                    hookUrl = 'https://smee.io/kyso-gitlab-hook-test'
                }
                webhook = await this.gitlabReposService.createWebhookGivenRepository(userAccount.accessToken, repositoryId, hookUrl)
                Logger.log(`Created webhook for repository '${repositoryId}' with id ${webhook.id}`, ReportsService.name)
            } catch (e) {
                Logger.error(`Error creating webhook for repository '${repositoryId}'`, e, ReportsService.name)
                // throw Error(`An error occurred creating webhook for repository '${repositoryId}'`)
            }
            report = new Report(
                slugify(gitlabRepository.name),
                gitlabRepository.id.toString(),
                webhook.id.toString(),
                RepositoryProvider.GITLAB,
                gitlabRepository.name,
                userAccount.username,
                gitlabRepository.defaultBranch,
                null,
                0,
                false,
                gitlabRepository.description,
                user.id,
                null,
                gitlabRepository.name,
                [],
                null,
                false,
                false,
                null,
            )
            report = await this.provider.create(report)
            Logger.log(`New report '${report.id} ${report.sluglified_name}'`, ReportsService.name)
            isNew = true
        }

        new Promise<void>(async () => {
            const desiredCommit: string = branch && branch.length > 0 ? branch : gitlabRepository.defaultBranch
            const extractedDir = `/tmp/${uuidv4()}`
            try {
                Logger.log(`Downloading and extrating repository ${repositoryId}' commit '${desiredCommit}'`, ReportsService.name)
                const buffer: Buffer = await this.gitlabReposService.downloadRepository(userAccount.accessToken, repositoryId, desiredCommit)
                if (!buffer) {
                    report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                    Logger.error(`Report '${report.id} ${repositoryId}': Could not download commit ${desiredCommit}`, ReportsService.name)
                    // throw new PreconditionFailedException(`Could not download repository ${repositoryId} commit ${desiredCommit}`, ReportsService.name)
                    return
                }
                Logger.log(`Report '${report.id} ${report.sluglified_name}': Downloaded commit '${desiredCommit}'`, ReportsService.name)
                const zip: AdmZip = new AdmZip(buffer)
                zip.extractAllTo('/tmp', true)
                moveSync(`/tmp/${zip.getEntries()[0].entryName}`, extractedDir, { overwrite: true })
                Logger.log(`Extracted repository '${repositoryId}' commit '${desiredCommit}' to '${extractedDir}'`, ReportsService.name)
            } catch (e) {
                await this.deleteReport(report.id)
                throw Error(`An error occurred downloading repository '${repositoryId}'`)
            }

            const filePaths: string[] = await this.getFilePaths(extractedDir)
            if (filePaths.length < 1) {
                report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                Logger.error(`Report ${report.id} ${repositoryId}: Repository does not contain any files`, ReportsService.name)
                throw new PreconditionFailedException(`Report ${report.id} ${repositoryId}: Repository does not contain any files`, ReportsService.name)
            }

            // Normalize file paths
            let files: { name: string; filePath: string }[] = []
            let kysoConfigFile: KysoConfigFile = null
            let directoriesToRemove: string[] = []
            try {
                const result = await this.normalizeFilePaths(report, filePaths)
                files = result.files
                kysoConfigFile = result.kysoConfigFile
                directoriesToRemove = result.directoriesToRemove
                Logger.log(`Downloaded ${files.length} files from repository ${repositoryId}' commit '${desiredCommit}'`, ReportsService.name)
            } catch (e) {
                await this.deleteReport(report.id)
                return null
            }

            const userHasPermission: boolean = await this.checkCreateReportPermission(userId, kysoConfigFile.team)
            if (!userHasPermission) {
                Logger.error(`User ${user.username} does not have permission to create report in team ${kysoConfigFile.team}`)
                await this.deleteReport(report.id)
                this.mailerService
                    .sendMail({
                        to: user.email,
                        subject: 'Error creating report',
                        template: 'report-error-permissions',
                    })
                    .then(() => {
                        Logger.log(`Mail 'Invalid permissions for creating report' sent to ${user.display_name}`, UsersService.name)
                    })
                    .catch((err) => {
                        Logger.error(`Error sending mail 'Invalid permissions for creating report' to ${user.display_name}`, err, UsersService.name)
                    })
                return
            }

            await this.uploadRepositoryFilesToS3(report, extractedDir, kysoConfigFile, files, directoriesToRemove, isNew)
        })

        return report
    }

    public async downloadBitbucketRepo(report: Report, repositoryName: any, desiredCommit: string, userAccount: UserAccount): Promise<void> {
        Logger.log(`Downloading and extrating repository ${report.sluglified_name}' commit '${desiredCommit}'`, ReportsService.name)
        report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Processing } })

        const extractedDir = `/tmp/${uuidv4()}`
        try {
            Logger.log(`Downloading and extrating repository ${repositoryName}' commit '${desiredCommit}'`, ReportsService.name)
            const buffer: Buffer = await this.bitbucketReposService.downloadRepository(userAccount.accessToken, repositoryName, desiredCommit)
            if (!buffer) {
                report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                Logger.error(`Report '${report.id} ${repositoryName}': Could not download commit ${desiredCommit}`, ReportsService.name)
                // throw new PreconditionFailedException(`Could not download repository ${repositoryName} commit ${desiredCommit}`, ReportsService.name)
                return
            }
            Logger.log(`Report '${report.id} ${report.sluglified_name}': Downloaded commit '${desiredCommit}'`, ReportsService.name)
            const zip: AdmZip = new AdmZip(buffer)
            zip.extractAllTo(extractedDir, true)
            Logger.log(`Extracted repository '${repositoryName}' commit '${desiredCommit}' to '${extractedDir}'`, ReportsService.name)
        } catch (e) {
            await this.deleteReport(report.id)
            throw Error(`An error occurred downloading repository '${repositoryName}'`)
        }
        Logger.log(`Report '${report.id} ${report.sluglified_name}': Downloaded commit '${desiredCommit}'`, ReportsService.name)

        const filePaths: string[] = await this.getFilePaths(extractedDir)
        if (filePaths.length < 2) {
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
            Logger.error(`Report ${report.id} ${report.sluglified_name}: Repository does not contain any files`, ReportsService.name)
            // throw new PreconditionFailedException(`Report ${report.id} ${report.sluglified_name}: Repository does not contain any files`, ReportsService.name)
            return
        }

        // Normalize file paths
        let files: { name: string; filePath: string }[] = []
        let kysoConfigFile: KysoConfigFile = null
        let directoriesToRemove: string[] = []
        try {
            const result = await this.normalizeFilePaths(report, filePaths)
            files = result.files
            kysoConfigFile = result.kysoConfigFile
            directoriesToRemove = result.directoriesToRemove
            Logger.log(`Downloaded ${files.length} files from repository ${report.sluglified_name}' commit '${desiredCommit}'`, ReportsService.name)
        } catch (e) {
            await this.deleteReport(report.id)
            return null
        }
        Logger.log(`Downloaded ${files.length} files from repository ${report.sluglified_name}' commit '${desiredCommit}'`, ReportsService.name)

        await this.uploadRepositoryFilesToS3(report, extractedDir, kysoConfigFile, files, directoriesToRemove, false)
    }

    public async downloadGitlabRepo(report: Report, repositoryName: any, desiredCommit: string, userAccount: UserAccount): Promise<void> {
        Logger.log(`Downloading and extrating repository ${report.sluglified_name}' commit '${desiredCommit}'`, ReportsService.name)
        report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Processing } })

        const extractedDir = `/tmp/${uuidv4()}`
        try {
            Logger.log(`Downloading and extrating repository ${repositoryName}' commit '${desiredCommit}'`, ReportsService.name)
            const buffer: Buffer = await this.gitlabReposService.downloadRepository(userAccount.accessToken, repositoryName, desiredCommit)
            if (!buffer) {
                report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                Logger.error(`Report '${report.id} ${repositoryName}': Could not download commit ${desiredCommit}`, ReportsService.name)
                // throw new PreconditionFailedException(`Could not download repository ${repositoryName} commit ${desiredCommit}`, ReportsService.name)
                return
            }
            Logger.log(`Report '${report.id} ${report.sluglified_name}': Downloaded commit '${desiredCommit}'`, ReportsService.name)
            const zip: AdmZip = new AdmZip(buffer)
            zip.extractAllTo(extractedDir, true)
            Logger.log(`Extracted repository '${repositoryName}' commit '${desiredCommit}' to '${extractedDir}'`, ReportsService.name)
        } catch (e) {
            await this.deleteReport(report.id)
            throw Error(`An error occurred downloading repository '${repositoryName}'`)
        }
        Logger.log(`Report '${report.id} ${report.sluglified_name}': Downloaded commit '${desiredCommit}'`, ReportsService.name)

        const filePaths: string[] = await this.getFilePaths(extractedDir)
        if (filePaths.length < 2) {
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
            Logger.error(`Report ${report.id} ${report.sluglified_name}: Repository does not contain any files`, ReportsService.name)
            // throw new PreconditionFailedException(`Report ${report.id} ${report.sluglified_name}: Repository does not contain any files`, ReportsService.name)
            return
        }

        // Normalize file paths
        let files: { name: string; filePath: string }[] = []
        let kysoConfigFile: KysoConfigFile = null
        let directoriesToRemove: string[] = []
        try {
            const result = await this.normalizeFilePaths(report, filePaths)
            files = result.files
            kysoConfigFile = result.kysoConfigFile
            directoriesToRemove = result.directoriesToRemove
            Logger.log(`Downloaded ${files.length} files from repository ${report.sluglified_name}' commit '${desiredCommit}'`, ReportsService.name)
        } catch (e) {
            await this.deleteReport(report.id)
            return null
        }
        Logger.log(`Downloaded ${files.length} files from repository ${report.sluglified_name}' commit '${desiredCommit}'`, ReportsService.name)

        await this.uploadRepositoryFilesToS3(report, extractedDir, kysoConfigFile, files, directoriesToRemove, false)
    }

    private async normalizeFilePaths(
        report: Report,
        filePaths: string[],
    ): Promise<{ files: { name: string; filePath: string }[]; kysoConfigFile: KysoConfigFile; directoriesToRemove: string[] }> {
        // Normalize file paths
        const relativePath: string = filePaths[0]
        const files: { name: string; filePath: string }[] = []
        let kysoConfigFile: KysoConfigFile = null
        const directoriesToRemove: string[] = []
        // Search kyso config file and annotate directories to remove at the end of the process
        for (let i = 1; i < filePaths.length; i++) {
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
                        Logger.error(`Report ${report.id} ${report.sluglified_name}: kyso.json config file is not valid`, ReportsService.name)
                        throw new PreconditionFailedException(`Report ${report.id} ${report.sluglified_name}: kyso.json config file is not valid`)
                    }
                } catch (e) {
                    report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                    Logger.error(`Report ${report.id} ${report.sluglified_name}: Could not parse kyso.json file`, ReportsService.name)
                    throw new PreconditionFailedException(`Report ${report.id} ${report.sluglified_name}: Could not parse kyso.json file`, ReportsService.name)
                }
            } else if (fileName === 'kyso.yml' || fileName === 'kyso.yaml') {
                try {
                    kysoConfigFile = jsYaml.load(readFileSync(filePath, 'utf8')) as KysoConfigFile
                    if (!KysoConfigFile.isValid(kysoConfigFile)) {
                        report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                        Logger.error(`Report ${report.id} ${report.sluglified_name}: kyso.{yml,yaml} config file is not valid`, ReportsService.name)
                        throw new PreconditionFailedException(`Report ${report.id} ${report.sluglified_name}: kyso.{yml,yaml} config file is not valid`)
                    }
                } catch (e) {
                    report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                    Logger.error(`Report ${report.id} ${report.sluglified_name}: Could not parse kyso.{yml,yaml} file`, ReportsService.name)
                    throw new PreconditionFailedException(
                        `Report ${report.id} ${report.sluglified_name}: Could not parse kyso.{yml,yaml} file`,
                        ReportsService.name,
                    )
                }
            }
            files.push({ name: fileName, filePath: filePath })
        }
        if (!kysoConfigFile) {
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
            Logger.error(`Report ${report.id} ${report.sluglified_name}: Repository does not contain a kyso.{json,yml,yaml} config file`, ReportsService.name)
            throw new PreconditionFailedException(
                `Repository ${report.sluglified_name} does not contain a kyso.{json,yml,yaml} config file`,
                ReportsService.name,
            )
        }
        return { files, kysoConfigFile, directoriesToRemove }
    }

    private async uploadRepositoryFilesToS3(
        report: Report,
        tmpDir: string,
        kysoConfigFile: KysoConfigFile,
        files: { name: string; filePath: string }[],
        directoriesToRemove: string[],
        isNew: boolean,
    ): Promise<void> {
        const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)
        const team: Team = await this.teamsService.getTeam({ filter: { sluglified_name: kysoConfigFile.team } })
        if (!team) {
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
            Logger.error(`Report ${report.id} ${report.sluglified_name}: Team ${kysoConfigFile.team} does not exist`, ReportsService.name)
            return
        }
        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)

        let mainFile = null
        if (kysoConfigFile?.main && kysoConfigFile.main.length > 0) {
            mainFile = kysoConfigFile.main
        }
        report = await this.provider.update(
            { _id: this.provider.toObjectId(report.id) },
            {
                $set: {
                    status: ReportStatus.Processing,
                    team_id: team.id,
                    title: kysoConfigFile.title || report.title,
                    main_file: mainFile || report?.main_file || null,
                    report_type: kysoConfigFile?.type && kysoConfigFile.type.length > 0 ? kysoConfigFile.type : null,
                },
            },
        )

        const lastVersion: number = await this.getLastVersionOfReport(report.id)
        const version = lastVersion + 1

        const reportPath: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.REPORT_PATH)
        const extractedDir = join(reportPath, `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}`)
        moveSync(tmpDir, extractedDir, { overwrite: true })

        let tmpFiles: string[] = await this.getFilePaths(extractedDir)
        // Remove '/reportPath' from the paths
        tmpFiles = tmpFiles.map((file: string) => file.replace(reportPath, ''))
        writeFileSync(join(reportPath, `/${report.id}.indexer`), tmpFiles.join('\n'))

        if (isNew) {
            await this.checkReportTags(report.id, kysoConfigFile.tags)
        }

        Logger.log(`Report '${report.id} ${report.sluglified_name}': Uploading files to Ftp...`, ReportsService.name)
        await this.uploadReportToFtp(report.id, extractedDir)

        const s3Client: S3Client = await this.getS3Client()

        // Get all report files
        for (let i = 0; i < files.length; i++) {
            files[i].filePath = files[i].filePath.replace(tmpDir, extractedDir)
            const originalName: string = files[i].name
            const sha: string = sha256File(files[i].filePath)
            const size: number = statSync(files[i].filePath).size
            const path_s3 = `${uuidv4()}_${sha}_${originalName}.zip`
            const path_scs = `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}/${originalName}`
            let reportFile: File = new File(report.id, originalName, path_s3, path_scs, size, sha, version)
            reportFile = await this.filesMongoProvider.create(reportFile)
            const zip = new AdmZip()
            const fileContent: Buffer = readFileSync(files[i].filePath)
            zip.addFile(originalName, fileContent)
            const outputFilePath = `/tmp/${uuidv4()}.zip`
            zip.writeZip(outputFilePath)
            Logger.log(`Report '${report.sluglified_name}': uploading file '${reportFile.name}' to S3...`, ReportsService.name)
            await s3Client.send(
                new PutObjectCommand({
                    Bucket: s3Bucket,
                    Key: reportFile.path_s3,
                    Body: readFileSync(outputFilePath),
                }),
            )
            Logger.log(`Report '${report.sluglified_name}': uploaded file '${reportFile.name}' to S3 with key '${reportFile.path_s3}'`, ReportsService.name)
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
        Logger.log(`Report '${report.id} ${report.sluglified_name}' imported`, ReportsService.name)

        await this.sendNewReportMail(report, team, organization, isNew)
    }

    private async createGithubWebhook(octokit: Octokit, username: string, repositoryName: string) {
        try {
            const baseUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.BASE_URL)

            let hookUrl = `${baseUrl}/v1/hooks/github`
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
            zip.extractAllTo('/tmp', true)
            moveSync(`/tmp/${zip.getEntries()[0].entryName}`, extractedDir, { overwrite: true })
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
        let checkedTags = tags
        if (!Array.isArray(tags)) {
            checkedTags = [tags]
        }
        const normalizedTags: string[] = checkedTags.map((tag: string) => tag.trim().toLocaleLowerCase())
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

        const team: Team = await this.teamsService.getTeam({ filter: { sluglified_name: teamName } })
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

        const reports: Report[] = await this.provider.read({ filter: { sluglified_name: reportName, team_id: team.id } })
        if (reports.length === 0) {
            response.status(404).send(`Report ${reportName} of team ${teamName} not found`)
            return
        }
        const report: Report = reports[0]

        this.returnZippedReport(report, response)
    }

    public async downloadReport(token: Token, reportId: string, response: any): Promise<void> {
        let isGlobalAdmin = false
        if (token.permissions.global?.includes(GlobalPermissionsEnum.GLOBAL_ADMIN)) {
            isGlobalAdmin = true
        }

        const report: Report = await this.getReportById(reportId)
        if (!report) {
            response.status(404).send(`Report '${reportId}' not found`)
            return
        }

        const team: Team = await this.teamsService.getTeamById(report.team_id)
        if (!team) {
            response.status(404).send(`Team '${report.team_id}' not found`)
            return
        }

        const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id)
        const index: number = teams.findIndex((t: Team) => t.id === team.id)
        if (!isGlobalAdmin && index === -1) {
            response.status(401).send(`User does not have permission to download report ${report.sluglified_name}`)
            return
        }
        this.returnZippedReport(report, response)
    }

    private async returnZippedReport(report: Report, response: any): Promise<void> {
        const lastVersion: number = await this.getLastVersionOfReport(report.id)
        const reportFiles: File[] = await this.filesMongoProvider.read({ filter: { report_id: report.id, version: lastVersion } })

        const s3Client: S3Client = await this.getS3Client()
        const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)

        const zip: AdmZip = new AdmZip()
        Logger.log(`Report '${report.sluglified_name}': downloading ${reportFiles.length} files from S3...`, ReportsService.name)
        for (const reportFile of reportFiles) {
            try {
                Logger.log(`Report '${report.sluglified_name}': downloading file ${reportFile.name}...`, ReportsService.name)
                const getObjectCommand: GetObjectCommand = new GetObjectCommand({
                    Bucket: s3Bucket,
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
                if (zipEntries.length === 0) {
                    Logger.error(`Error downloading file '${reportFile.name}' from S3`, ReportsService.name)
                    continue
                }
                const zipEntry: AdmZip.IZipEntry = zipEntries[0]
                Logger.log(`Report '${report.sluglified_name}': adding file '${reportFile.name}' to zip...`, ReportsService.name)
                zip.addFile(reportFile.name, reportFileZip.readFile(zipEntry))
            } catch (e) {
                Logger.error(`An error occurred downloading file '${reportFile.name}' from S3`, e, ReportsService.name)
            }
        }

        response.set('Content-Disposition', `attachment; filename=${report.id}.zip`)
        response.set('Content-Type', 'application/zip')
        response.send(zip.toBuffer())
        Logger.log(`Report '${report.sluglified_name}': zip sent to user`, ReportsService.name)
    }

    private async getKysoReportTree(reportId: string, path: string, version: number | null): Promise<GithubFileHash[]> {
        const lastVersion: number = await this.getLastVersionOfReport(reportId)
        const query: any = {
            filter: {
                report_id: reportId,
                version: version || lastVersion,
            },
        }
        let reportFiles: File[] = await this.filesMongoProvider.read(query)
        if (reportFiles.length === 0) {
            return []
        }

        let sanitizedPath = ''
        if (path && (path == './' || path == '/' || path == '.' || path == '/.')) {
            sanitizedPath = ''
        } else if (path && path.length > 0) {
            sanitizedPath = path.replace('./', '').replace(/\/$/, '')
        }

        let filesInPath: any[] = [...reportFiles]

        if (sanitizedPath !== '') {
            // Get the files that are in the path
            reportFiles = reportFiles.filter((file: File) => file.name.startsWith(sanitizedPath + '/') || file.name.startsWith(sanitizedPath))
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
            const justFile: File = reportFiles.find((file: File) => file.name.startsWith(sanitizedPath))
            return [
                {
                    type: 'file',
                    path: justFile.name.replace(`${sanitizedPath}/`, ''),
                    hash: justFile.sha,
                    htmlUrl: '',
                    path_scs: justFile.path_scs,
                    version: justFile.version,
                },
            ]
        }

        if (result.length === 1 && result[0].children.length > 0) {
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
                    path_scs: file.path_scs,
                    version: file.version,
                })
            } else {
                // File
                tree.push({
                    type: 'file',
                    path: file.name.replace(`${sanitizedPath}/`, ''),
                    hash: file.sha,
                    htmlUrl: '',
                    path_scs: file.path_scs,
                    version: file.version,
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
        const reportFile: File = files[files.length - 1]
        try {
            const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)
            const getObjectCommand: GetObjectCommand = new GetObjectCommand({
                Bucket: s3Bucket,
                Key: reportFile.path_s3,
            })
            const s3Client: S3Client = await this.getS3Client()
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
        } catch (e) {
            Logger.error(`An error occurred while downloading file '${reportFile.name}' from S3`, e, ReportsService.name)
            return null
        }
    }

    public async setPreviewPicture(reportId: string, file: any): Promise<Report> {
        const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('Report not found')
        }
        const s3Client: S3Client = await this.getS3Client()
        if (report?.preview_picture && report.preview_picture.length > 0) {
            Logger.log(`Removing previous image of report ${report.sluglified_name}`, ReportsService.name)
            const deleteObjectCommand: DeleteObjectCommand = new DeleteObjectCommand({
                Bucket: s3Bucket,
                Key: report.preview_picture.split('/').slice(-1)[0],
            })
            await s3Client.send(deleteObjectCommand)
        }
        Logger.log(`Uploading image for report ${report.sluglified_name}`, ReportsService.name)
        const Key = `${uuidv4()}${extname(file.originalname)}`
        await s3Client.send(
            new PutObjectCommand({
                Bucket: s3Bucket,
                Key,
                Body: file.buffer,
            }),
        )
        Logger.log(`Uploaded image for report ${report.sluglified_name}`, ReportsService.name)
        const preview_picture = `https://${s3Bucket}.s3.amazonaws.com/${Key}`
        return this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { preview_picture } })
    }

    public async deletePreviewPicture(reportId: string): Promise<Report> {
        const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('Report not found')
        }
        const s3Client: S3Client = await this.getS3Client()
        if (report?.preview_picture && report.preview_picture.length > 0) {
            Logger.log(`Removing previous image of report ${report.sluglified_name}`, OrganizationsService.name)
            const deleteObjectCommand: DeleteObjectCommand = new DeleteObjectCommand({
                Bucket: s3Bucket,
                Key: report.preview_picture.split('/').slice(-1)[0],
            })
            await s3Client.send(deleteObjectCommand)
        }
        return this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { preview_picture: null } })
    }

    public async getReportFiles(reportId: string, version: string): Promise<File[]> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('Report not found')
        }
        const query: any = {
            filter: {
                report_id: reportId,
            },
            sort: {
                version: 1,
            },
        }
        if (version && version.length > 0 && !isNaN(version as any)) {
            query.filter.version = parseInt(version, 10)
        }
        return this.filesMongoProvider.read(query)
    }

    public async getReportVersions(reportId: string): Promise<{ version: number; created_at: Date; num_files: number }[]> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('Report not found')
        }
        const query: any = {
            filter: {
                report_id: reportId,
            },
            sort: {
                version: 1,
            },
        }
        const files: File[] = await this.filesMongoProvider.read(query)
        const map: Map<number, { version: number; created_at: Date; num_files: number }> = new Map<
            number,
            { version: number; created_at: Date; num_files: number }
        >()
        files.forEach((file: File) => {
            if (!map.has(file.version)) {
                map.set(file.version, {
                    version: file.version,
                    created_at: file.created_at,
                    num_files: 0,
                })
            }
            map.get(file.version).num_files++
        })
        return Array.from(map.values())
    }

    private async checkCreateReportPermission(userId: string, teamName: string): Promise<boolean> {
        const user: User = await this.usersService.getUserById(userId)

        const permissions: TokenPermissions = await AuthService.buildFinalPermissionsForUser(
            user.username,
            this.usersService,
            this.teamsService,
            this.organizationsService,
            this.platformRoleService,
            this.userRoleService,
        )

        if (permissions?.global && permissions.global.includes(GlobalPermissionsEnum.GLOBAL_ADMIN)) {
            return true
        }

        const teamResourcePermissions: ResourcePermissions = permissions.teams.find((t: ResourcePermissions) => t.name === teamName)
        if (!teamResourcePermissions) {
            Logger.log(`User ${user.username} is not a member of the team ${teamName}`, ReportsService.name)
            return false
        }

        if (teamResourcePermissions?.permissions && Array.isArray(teamResourcePermissions.permissions)) {
            return teamResourcePermissions.permissions.includes(ReportPermissionsEnum.CREATE)
        } else {
            // Check if the user is a member of the organization
            const organizationResourcePermissions: ResourcePermissions = permissions.organizations.find(
                (o: ResourcePermissions) => o.id === teamResourcePermissions.organization_id,
            )
            if (!organizationResourcePermissions) {
                Logger.log(`User ${user.username} is not a member of the organization ${organizationResourcePermissions.name}`, ReportsService.name)
                return false
            }
            return organizationResourcePermissions.permissions.includes(ReportPermissionsEnum.CREATE)
        }
    }

    public async getReportByName(reportName: string, teamName: string): Promise<Report> {
        const team: Team = await this.teamsService.getTeam({
            filter: {
                sluglified_name: teamName,
            },
        })
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }
        const report: Report = await this.getReport({
            filter: {
                sluglified_name: reportName,
                team_id: team.id,
            },
        })
        if (!report) {
            throw new PreconditionFailedException('Report not found')
        }
        return report
    }

    private async uploadReportToFtp(reportId: string, sourcePath: string): Promise<void> {
        const report: Report = await this.getReportById(reportId)
        const version: number = await this.getLastVersionOfReport(reportId)
        const team: Team = await this.teamsService.getTeamById(report.team_id)
        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
        const client: Client = await this.sftpService.getClient()
        const sftpDestinationFolder = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_DESTINATION_FOLDER)
        const destinationPath = join(
            sftpDestinationFolder,
            `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}`,
        )
        const existsPath: boolean | string = await client.exists(destinationPath)
        if (!existsPath) {
            Logger.log(`Directory ${destinationPath} does not exist. Creating...`, ReportsService.name)
            await client.mkdir(destinationPath, true)
            Logger.log(`Created directory ${destinationPath}`, ReportsService.name)
        }
        const result: string = await client.uploadDir(sourcePath, destinationPath)
        Logger.log(result, ReportsService.name)
        await client.end()
    }

    private async getLastVersionOfReport(reportId: string): Promise<number> {
        const query: any = {
            filter: {
                report_id: reportId,
            },
            sort: {
                version: -1,
            },
        }
        const files: File[] = await this.filesMongoProvider.read(query)
        if (files.length === 0) {
            return 0
        }
        return files[0].version
    }
}
