import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import {
    Comment,
    CreateReportDTO,
    File,
    GithubBranch,
    GithubFileHash,
    GithubRepository,
    GlobalPermissionsEnum,
    KysoConfigFile,
    KysoSettingsEnum,
    LoginProviderEnum,
    Organization,
    PinnedReport,
    Report,
    ReportDTO,
    ReportPermissionsEnum,
    ReportStatus,
    ReportType,
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
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { moveSync } from 'fs-extra'
import * as glob from 'glob'
import * as jsYaml from 'js-yaml'
import { extname, join } from 'path'
import * as sha256File from 'sha256-file'
import { GenericService } from '../../generic/service.generic'
import * as Client from 'ssh2-sftp-client'
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
import { FullTextSearchService } from '../full-text-search/full-text-search.service'
import { GithubReposService } from '../github-repos/github-repos.service'
import { GitlabReposService } from '../gitlab-repos/gitlab-repos.service'
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
import { PlatformRole } from 'src/security/platform-roles'
import { replaceStringInFilesSync } from 'tiny-replace-files'


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
export class ReportsService extends AutowiredService implements GenericService<Report> {
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

    @Autowired({ typeName: 'SftpService' })
    private sftpService: SftpService

    @Autowired({ typeName: 'FullTextSearchService' })
    private fullTextSearchService: FullTextSearchService

    constructor(
        private readonly mailerService: MailerService,
        private readonly provider: ReportsMongoProvider,
        private readonly pinnedReportsMongoProvider: PinnedReportsMongoProvider,
        private readonly starredReportsMongoProvider: StarredReportsMongoProvider,
        private readonly filesMongoProvider: FilesMongoProvider,
    ) {
        super()
    }
    checkOwnership(item: Report, requester: Token, organizationName: string, teamName: string): Promise<boolean> {
        let hasAdequatePermissions
        
        // Check if the user who is requesting the edition of the discussion is the owner of the discussion
        if(item.user_id === requester.id) {
            hasAdequatePermissions = true 
        } else {
            hasAdequatePermissions = false 
        }

        if(!hasAdequatePermissions) {
            // Check if the user who is requesting the edition of the discussion has TEAM_ADMIN or ORG_ADMIN
            const teamPermissions = requester.permissions.teams.find(x => x.name === teamName)

            if(teamPermissions && teamPermissions.role_names) {
                const isTeamAdmin = teamPermissions.role_names.find(x => x === PlatformRole.TEAM_ADMIN_ROLE.name) !== undefined 
                const isOrgAdmin = teamPermissions.role_names.find(x => x === PlatformRole.ORGANIZATION_ADMIN_ROLE.name) !== undefined
                const isPlatformAdmin = teamPermissions.role_names.find(x => x === PlatformRole.PLATFORM_ADMIN_ROLE.name) !== undefined

                if(isTeamAdmin || isOrgAdmin || isPlatformAdmin) {
                    hasAdequatePermissions = true 
                } else {
                    hasAdequatePermissions = false
                }
            }
        }

        return hasAdequatePermissions
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
        Logger.log(`With data ${updateReportRequestDTO}`)

        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new NotFoundError({ message: 'The specified report could not be found' })
        }
        if (updateReportRequestDTO?.tags) {
            await this.checkReportTags(report.id, updateReportRequestDTO.tags || [])
            delete updateReportRequestDTO.tags
        }
        const dataToUpdate: any = {
            author_ids: [...report.author_ids],
        }
        if (dataToUpdate.author_ids.indexOf(userId) === -1) {
            dataToUpdate.author_ids.push(userId)
        }
        if (updateReportRequestDTO.title && updateReportRequestDTO.title !== report.title) {
            dataToUpdate.title = updateReportRequestDTO.title
        }
        if (updateReportRequestDTO.description && updateReportRequestDTO.description !== report.description) {
            dataToUpdate.description = updateReportRequestDTO.description
        }
        if (updateReportRequestDTO.hasOwnProperty('show_code') && updateReportRequestDTO.show_code != null) {
            dataToUpdate.show_code = updateReportRequestDTO.show_code
        }
        if (updateReportRequestDTO.hasOwnProperty('show_output') && updateReportRequestDTO.show_output != null) {
            dataToUpdate.show_ouput = updateReportRequestDTO.show_output
        }
        if (updateReportRequestDTO.hasOwnProperty('main_file') && updateReportRequestDTO.main_file != null && updateReportRequestDTO.main_file.length > 0) {
            dataToUpdate.main_file = updateReportRequestDTO.main_file
        }
        return this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: dataToUpdate })
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

        // Delete report in SFTP
        this.deleteReportFromFtp(report.id)

        // Delete all indexed contents in fulltextsearch
        const team: Team = await this.teamsService.getTeamById(report.team_id)
        if (team) {
            const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
            if (organization) {
                this.fullTextSearchService.deleteIndexedResults(organization.sluglified_name, team.sluglified_name, report.sluglified_name, 'report')
            }
        }

        // Delete files
        await this.filesMongoProvider.deleteMany({ report_id: reportId })

        // Delete preview image
        await this.deletePreviewPicture(reportId)

        await this.provider.deleteOne({ _id: this.provider.toObjectId(reportId) })
        return report
    }

    public async getBranches(reportId: string): Promise<GithubBranch[]> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('The specified report could not be found')
        }
        return this.localReportsService.getReportVersions(report.id)
    }

    public async getReportTree(reportId: string, path: string, version: number | null): Promise<GithubFileHash | GithubFileHash[]> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            throw new NotFoundError({ message: 'The specified report could not be found' })
        }
        return this.getKysoReportTree(report.id, path, version)
    }

    public async getFileById(id: string): Promise<File> {
        const files: File[] = await this.filesMongoProvider.read({
            filter: {
                _id: this.provider.toObjectId(id),
            },
        })
        return files.length > 0 ? files[0] : null
    }

    public async getReportFileContent(file: File): Promise<Buffer> {
        try {
            const client: Client = await this.sftpService.getClient()
            const sftpDestinationFolder = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_DESTINATION_FOLDER)
            const destinationPath = join(sftpDestinationFolder, file.path_scs)
            const existsPath: boolean | string = await client.exists(destinationPath)
            if (!existsPath) {
                Logger.error(`File ${destinationPath} does not exists`, ReportsService.name)
                return null
            }
            return (await client.get(destinationPath)) as Buffer
        } catch (e) {
            Logger.error(`An error occurred while downloading file '${file.name}' from SCS`, e, ReportsService.name)
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

    public async reportModelToReportDTO(report: Report, userId: string, version?: number): Promise<ReportDTO> {
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
                    version: version ?? lastVersion,
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
            mainFile ? mainFile.id : null,
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

    public async createKysoReport(userId: string, file: Express.Multer.File): Promise<Report | Report[]> {
        Logger.log('Creating report')
        const user: User = await this.usersService.getUserById(userId)
        Logger.log(`By user: ${user.email}`)
        const isGlobalAdmin: boolean = user.global_permissions.includes(GlobalPermissionsEnum.GLOBAL_ADMIN)
        Logger.log(`is global admin?: ${isGlobalAdmin}`)

        const tmpFolder: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.TMP_FOLDER_PATH)
        const tmpDir = `${tmpFolder}/${uuidv4()}`
        const zip = new AdmZip(file.buffer)
        zip.extractAllTo(tmpDir, true)

        Logger.log(`Extracted zip file to ${tmpDir}`)

        let kysoConfigFile: KysoConfigFile = null
        for (const entry of zip.getEntries()) {
            const originalName: string = entry.entryName
            const localFilePath = join(tmpDir, entry.entryName)
            if (originalName === 'kyso.json') {
                try {
                    kysoConfigFile = JSON.parse(readFileSync(localFilePath).toString())
                    break
                } catch (e: any) {
                    Logger.error(`An error occurred parsing kyso.json`, e, ReportsService.name)
                    throw new PreconditionFailedException(`An error occurred parsing kyso.json`)
                }
            } else if (originalName === 'kyso.yml' || originalName === 'kyso.yaml') {
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

        const { valid, message } = KysoConfigFile.isValid(kysoConfigFile)
        if (!valid) {
            Logger.error(`Kyso config file is not valid: ${message}`, ReportsService.name)
            throw new PreconditionFailedException(`Kyso config file is not valid: ${message}`)
        }

        if (kysoConfigFile.type === ReportType.Meta) {
            return this.createMultipleKysoReports(kysoConfigFile, tmpDir, zip, user)
        }

        const organization: Organization = await this.organizationsService.getOrganization({
            filter: {
                sluglified_name: kysoConfigFile.organization,
            },
        })
        if (!organization) {
            Logger.error(`Organization ${kysoConfigFile.organization} not found`, ReportsService.name)
            throw new PreconditionFailedException(`Organization ${kysoConfigFile.organization} not found`)
        }

        const team: Team = await this.teamsService.getTeam({ filter: { sluglified_name: kysoConfigFile.team, organization_id: organization.id } })
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
                const path_scs = `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}/${entry.entryName}`
                let reportFile = new File(report.id, originalName, path_scs, size, sha, version)
                reportFile = await this.filesMongoProvider.create(reportFile)
                reportFiles.push(reportFile)
            }
        } else {
            Logger.log(`Creating new report '${name}'`, ReportsService.name)
            // New report
            report = new Report(
                name,
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
                const path_scs = `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}/${entry.entryName}`
                let file: File = new File(report.id, originalName, path_scs, size, sha, 1)
                file = await this.filesMongoProvider.create(file)
                reportFiles.push(file)
                if (kysoConfigFile?.preview && originalName === kysoConfigFile.preview) {
                    const s3Client: S3Client = await this.getS3Client()
                    const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)
                    const key = `${uuidv4()}${extname(originalName)}`
                    await s3Client.send(
                        new PutObjectCommand({
                            Bucket: s3Bucket,
                            Key: key,
                            Body: readFileSync(localFilePath),
                        }),
                    )
                    const preview_picture = `https://${s3Bucket}.s3.amazonaws.com/${key}`
                    report.preview_picture = preview_picture
                    report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { preview_picture: preview_picture } })
                }
            }
            await this.checkReportTags(report.id, kysoConfigFile.tags)
        }

        new Promise<void>(async () => {
            Logger.log(`Report '${report.id} ${report.sluglified_name}': Uploading files to Ftp...`, ReportsService.name)
            await this.uploadReportToFtp(report.id, extractedDir)
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Imported } })
            Logger.log(`Report '${report.id} ${report.sluglified_name}' imported`, ReportsService.name)

            let files: string[] = await this.getFilePaths(extractedDir)
            // Remove '/reportPath' from the paths
            files = files.map((file: string) => file.replace(reportPath, ''))

            const kysoIndexerApi: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.KYSO_INDEXER_API_BASE_URL)
            const pathToIndex: string = `${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}`

            axios.get(`${kysoIndexerApi}/api/index?pathToIndex=${pathToIndex}`).then(
                () => {},
                (err) => {
                    Logger.warn(`${pathToIndex} was not indexed properly`, err)
                },
            )

            // writeFileSync(join(reportPath, `/${report.id}.indexer`), files.join('\n'))

            await this.sendNewReportMail(report, team, organization, isNew)
        })

        return report
    }

    public async createMultipleKysoReports(baseKysoConfigFile: KysoConfigFile, baseTmpDir: string, zip: AdmZip, user: User): Promise<Report[]> {
        const kysoConfigFilesMap: Map<string, { kysoConfigFile: KysoConfigFile; organization: Organization; team: Team }> = new Map<
            string,
            { kysoConfigFile: KysoConfigFile; organization: Organization; team: Team }
        >()

        for (const reportFolderName of baseKysoConfigFile.reports) {
            let kysoConfigFile: KysoConfigFile = null
            for (const entry of zip.getEntries()) {
                if (entry.entryName.startsWith(reportFolderName)) {
                    const originalName: string = entry.entryName
                    const localFilePath = join(baseTmpDir, entry.entryName)
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
            }

            if (!kysoConfigFile) {
                Logger.error(`No kyso.{yml,yaml,json} file found for directoy ${reportFolderName}`, ReportsService.name)
                throw new PreconditionFailedException(`No kyso.{yml,yaml,json} file found ${reportFolderName}`)
            }

            if (!kysoConfigFile.hasOwnProperty('organization')) {
                if (!baseKysoConfigFile.hasOwnProperty('organization')) {
                    Logger.error(`Property organization is required for report folder ${reportFolderName}`, ReportsService.name)
                    throw new PreconditionFailedException(`Property organization is required for report folder ${reportFolderName}`)
                }
                if (baseKysoConfigFile.organization.length === 0) {
                    Logger.error(`Property organization for report folder ${reportFolderName} must have value`, ReportsService.name)
                    throw new PreconditionFailedException(`Property organization for report folder ${reportFolderName} must have value`)
                }
                kysoConfigFile.organization = kysoConfigFile.organization
            }
            if (!kysoConfigFile.hasOwnProperty('team')) {
                if (!baseKysoConfigFile.hasOwnProperty('team')) {
                    Logger.error(`Property team is required for report folder ${reportFolderName}`, ReportsService.name)
                    throw new PreconditionFailedException(`Property team is required for report folder ${reportFolderName}`)
                }
                if (baseKysoConfigFile.team.length === 0) {
                    Logger.error(`Property team for report folder ${reportFolderName} must have value`, ReportsService.name)
                    throw new PreconditionFailedException(`Property team for report folder ${reportFolderName} must have value`)
                }
                kysoConfigFile.team = kysoConfigFile.team
            }
            if (!kysoConfigFile.hasOwnProperty('tags')) {
                if (baseKysoConfigFile.hasOwnProperty('tags') && baseKysoConfigFile.tags.length > 0) {
                    kysoConfigFile.tags = baseKysoConfigFile.tags
                }
            }

            const { valid, message } = KysoConfigFile.isValid(kysoConfigFile)
            if (!valid) {
                Logger.error(`Kyso config file is not valid: ${message}`, ReportsService.name)
                throw new PreconditionFailedException(`Kyso config file is not valid: ${message}`)
            }

            const organization: Organization = await this.organizationsService.getOrganization({
                filter: {
                    sluglified_name: kysoConfigFile.organization,
                },
            })
            if (!organization) {
                Logger.error(`Organization ${kysoConfigFile.organization} not found`, ReportsService.name)
                throw new PreconditionFailedException(`Organization ${kysoConfigFile.organization} not found`)
            }

            const team: Team = await this.teamsService.getTeam({ filter: { sluglified_name: kysoConfigFile.team, organization_id: organization.id } })
            Logger.log(`Team: ${team.sluglified_name}`)
            if (!team) {
                Logger.error(`Team ${kysoConfigFile.team} does not exist`)
                throw new PreconditionFailedException(`Team ${kysoConfigFile.team} does not exist`)
            }
            const userHasPermission: boolean = await this.checkCreateReportPermission(user.id, kysoConfigFile.team)
            if (!userHasPermission) {
                Logger.error(`User ${user.username} does not have permission to create report in team ${kysoConfigFile.team}`)
                throw new ForbiddenException(`User ${user.username} does not have permission to create report in team ${kysoConfigFile.team}`)
            }

            kysoConfigFilesMap.set(reportFolderName, { kysoConfigFile, organization, team })
        }

        const newReports: Report[] = []
        for (const [reportFolderName, { kysoConfigFile, organization, team }] of kysoConfigFilesMap.entries()) {
            const name: string = slugify(kysoConfigFile.title)
            const reports: Report[] = await this.provider.read({ filter: { sluglified_name: name, team_id: team.id } })
            const reportFiles: File[] = []
            let version = 1
            let report: Report = null
            const tmpDir: string = join(baseTmpDir, reportFolderName)
            let isNew = false
            if (reports.length > 0) {
                // Existing report
                report = reports[0]
                const lastVersion: number = await this.getLastVersionOfReport(report.id)
                version = lastVersion + 1
                Logger.log(`Report '${report.id} ${report.sluglified_name}': Checking files...`, ReportsService.name)
                for (const entry of zip.getEntries()) {
                    if (!entry.entryName.startsWith(reportFolderName)) {
                        continue
                    }
                    const originalName: string = entry.entryName.replace(`${reportFolderName}/`, '')
                    const localFilePath = join(baseTmpDir, entry.entryName)
                    if (entry.isDirectory) {
                        continue
                    }
                    const sha: string = sha256File(localFilePath)
                    const size: number = statSync(localFilePath).size
                    const path_scs = `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}/${originalName}`
                    let reportFile = new File(report.id, originalName, path_scs, size, sha, version)
                    reportFile = await this.filesMongoProvider.create(reportFile)
                    reportFiles.push(reportFile)
                }
            } else {
                Logger.log(`Creating new report '${name}'`, ReportsService.name)
                // New report
                report = new Report(
                    name,
                    null,
                    RepositoryProvider.KYSO_CLI,
                    name,
                    null,
                    null,
                    null,
                    0,
                    false,
                    kysoConfigFile.description,
                    user.id,
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
                for (const entry of zip.getEntries()) {
                    if (!entry.entryName.startsWith(reportFolderName)) {
                        continue
                    }
                    const originalName: string = entry.entryName.replace(`${reportFolderName}/`, '')
                    const localFilePath = join(baseTmpDir, entry.entryName)
                    if (entry.isDirectory) {
                        continue
                    }
                    const sha: string = sha256File(localFilePath)
                    const size: number = statSync(localFilePath).size
                    const path_scs = `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}/${originalName}`
                    let file: File = new File(report.id, originalName, path_scs, size, sha, 1)
                    file = await this.filesMongoProvider.create(file)
                    reportFiles.push(file)
                    if (kysoConfigFile?.preview && originalName === kysoConfigFile.preview) {
                        const s3Client: S3Client = await this.getS3Client()
                        const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)
                        const key = `${uuidv4()}${extname(originalName)}`
                        await s3Client.send(
                            new PutObjectCommand({
                                Bucket: s3Bucket,
                                Key: key,
                                Body: readFileSync(localFilePath),
                            }),
                        )
                        const preview_picture = `https://${s3Bucket}.s3.amazonaws.com/${key}`
                        report.preview_picture = preview_picture
                        report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { preview_picture: preview_picture } })
                    }
                }
                await this.checkReportTags(report.id, kysoConfigFile.tags)
            }

            newReports.push(report)

            new Promise<void>(async () => {
                Logger.log(`Report '${report.id} ${report.sluglified_name}': Uploading files to Ftp...`, ReportsService.name)
                await this.uploadReportToFtp(report.id, tmpDir)
                report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Imported } })
                Logger.log(`Report '${report.id} ${report.sluglified_name}' imported`, ReportsService.name)

                let files: string[] = await this.getFilePaths(tmpDir)
                // Remove '/reportPath' from the paths
                files = files.map((file: string) => file.replace(tmpDir, ''))

                const kysoIndexerApi: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.KYSO_INDEXER_API_BASE_URL)
                const pathToIndex: string = `${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}`

                axios.get(`${kysoIndexerApi}/api/index?pathToIndex=${pathToIndex}`).then(
                    () => {},
                    (err) => {
                        Logger.warn(`${pathToIndex} was not indexed properly`, err)
                    },
                )

                await this.sendNewReportMail(report, team, organization, isNew)
            })
        }
        return newReports
    }

    public async createUIReport(userId: string, file: Express.Multer.File): Promise<Report> {
        Logger.log('Creating report')
        const user: User = await this.usersService.getUserById(userId)
        Logger.log(`By user: ${user.email}`)
        const isGlobalAdmin: boolean = user.global_permissions.includes(GlobalPermissionsEnum.GLOBAL_ADMIN)
        Logger.log(`is global admin?: ${isGlobalAdmin}`)

        const tmpFolder: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.TMP_FOLDER_PATH)
        const tmpDir = `${tmpFolder}/${uuidv4()}`
        const zip = new AdmZip(file.buffer)
        Logger.log(`Extracting all temporary files to ${tmpDir}`)
        zip.extractAllTo(tmpDir, true)

        let kysoConfigFile: KysoConfigFile = null

        Logger.log(`Looking for kyso.json|yaml|yml file`)
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

        const organization: Organization = await this.organizationsService.getOrganization({
            filter: {
                sluglified_name: kysoConfigFile.organization,
            },
        })
        if (!organization) {
            Logger.error(`Organization ${kysoConfigFile.organization} not found`, ReportsService.name)
            throw new PreconditionFailedException(`Organization ${kysoConfigFile.organization} not found`)
        }
        const team: Team = await this.teamsService.getTeam({ filter: { sluglified_name: kysoConfigFile.team, organization_id: organization.id } })
        Logger.log(`Team: ${team.sluglified_name}`)
        if (!team) {
            Logger.error(`Team ${kysoConfigFile.team} does not exist`)
            throw new PreconditionFailedException(`Team ${kysoConfigFile.team} does not exist`)
        }
        const userHasPermission: boolean = await this.checkCreateReportPermission(userId, kysoConfigFile.team)
        if (!userHasPermission) {
            Logger.error(`User ${user.username} does not have permission to create report in team ${kysoConfigFile.team}`)
            throw new ForbiddenException(`User ${user.username} does not have permission to create report in team ${kysoConfigFile.team}`)
        }
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
            const path_scs = `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}/${entry.entryName}`
            let file: File = new File(report.id, originalName, path_scs, size, sha, version)
            file = await this.filesMongoProvider.create(file)
            reportFiles.push(file)
            if (kysoConfigFile?.preview && originalName === kysoConfigFile.preview) {
                const s3Client: S3Client = await this.getS3Client()
                const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)
                const key = `${uuidv4()}${extname(originalName)}`
                await s3Client.send(
                    new PutObjectCommand({
                        Bucket: s3Bucket,
                        Key: key,
                        Body: readFileSync(localFilePath),
                    }),
                )
                const preview_picture = `https://${s3Bucket}.s3.amazonaws.com/${key}`
                report.preview_picture = preview_picture
                report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { preview_picture: preview_picture } })
            }
        }

        await this.checkReportTags(report.id, kysoConfigFile.tags)

        new Promise<void>(async () => {
            Logger.log(`Report '${report.id} ${report.sluglified_name}': Uploading files to Ftp...`, ReportsService.name)
            await this.uploadReportToFtp(report.id, extractedDir)
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Imported } })
            Logger.log(`Report '${report.id} ${report.sluglified_name}' imported`, ReportsService.name)

            let files: string[] = await this.getFilePaths(extractedDir)
            // Remove '/reportPath' from the paths
            files = files.map((file: string) => file.replace(reportPath, ''))

            const kysoIndexerApi: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.KYSO_INDEXER_API_BASE_URL)
            const pathToIndex: string = `${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}`

            axios.get(`${kysoIndexerApi}/api/index?pathToIndex=${pathToIndex}`).then(
                () => {},
                (err) => {
                    Logger.warn(`${pathToIndex} was not indexed properly`, err)
                },
            )

            // writeFileSync(join(reportPath, `/${report.id}.indexer`), files.join('\n'))

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
        const lastVersion: number = await this.getLastVersionOfReport(report.id)
        const files: File[] = await this.filesMongoProvider.read({ filter: { report_id: report.id, name: report.main_file, version: lastVersion } })
        if (files.length === 0) {
            throw new NotFoundException(`File with name '${report.main_file}' not found`)
        }
        let mainFileReport: File = files[0]

        Logger.log(`Report '${report.id} ${report.sluglified_name}': Uploading main file to Ftp...`, ReportsService.name)
        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
        const client: Client = await this.sftpService.getClient()
        const sftpDestinationFolder = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_DESTINATION_FOLDER)
        const ftpReportPath: string = join(
            sftpDestinationFolder,
            `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${lastVersion}`,
        )
        const exists = await client.exists(ftpReportPath)
        Logger.log(`Checking if folder '${ftpReportPath}' exists in SCS...`, ReportsService.name)
        if (!exists) {
            throw new PreconditionFailedException(`Report '${report.id} ${report.sluglified_name}': Destination path '${ftpReportPath}' not found`)
        }
        Logger.log(`Folder '${ftpReportPath}' exists in SCS.`, ReportsService.name)
        const tmpFolder: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.TMP_FOLDER_PATH)
        const localReportPath: string = join(
            tmpFolder,
            `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${lastVersion}`,
        )
        if (!existsSync(localReportPath)) {
            Logger.log(`LOCAL folder '${localReportPath}' not found. Creating...`, ReportsService.name)
            mkdirSync(localReportPath, { recursive: true })
            Logger.log(`LOCAL folder '${localReportPath}' created.`, ReportsService.name)
        }
        Logger.log(`Downloading directory '${ftpReportPath}' from SCS to LOCAL '${localReportPath}'...`, ReportsService.name)
        const resultDownload = await client.downloadDir(ftpReportPath, localReportPath)
        Logger.log(resultDownload, ReportsService.name)
        Logger.log(`Report '${report.id} ${report.sluglified_name}': Downloaded version ${lastVersion} from Ftp`, ReportsService.name)
        const mainFileReportLocalPath = join(localReportPath, mainFileReport.name)
        writeFileSync(mainFileReportLocalPath, file.buffer)
        const destinationPathNewVersion: string = join(
            sftpDestinationFolder,
            `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${lastVersion + 1}`,
        )
        const result = await client.uploadDir(localReportPath, destinationPathNewVersion)
        Logger.log(result, ReportsService.name)
        // Create new version for each file
        const filesLastVersion: File[] = await this.filesMongoProvider.read({ filter: { report_id: report.id, version: lastVersion } })
        for (const fileLastVersion of filesLastVersion) {
            let sha: string = fileLastVersion.sha
            let size: number = fileLastVersion.size
            if (fileLastVersion.id === mainFileReport.id) {
                sha = sha256File(mainFileReportLocalPath)
                size = statSync(mainFileReportLocalPath).size
            }
            const path_scs: string = `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${lastVersion + 1}/${
                fileLastVersion.name
            }`
            let fileNewVersion: File = new File(report.id, fileLastVersion.name, path_scs, size, sha, lastVersion + 1)
            fileNewVersion = await this.filesMongoProvider.create(fileNewVersion)
            Logger.log(
                `Report '${report.id} ${report.sluglified_name}': Created new version ${lastVersion + 1} for file '${fileLastVersion.name}'`,
                ReportsService.name,
            )
        }
        Logger.log(`Deleting LOCAL folder '${localReportPath}'...`, ReportsService.name)
        rmSync(localReportPath, { recursive: true })
        Logger.log(`LOCAL folder '${localReportPath}' deleted.`, ReportsService.name)
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
            report = new Report(
                slugify(repository.name),
                repository.id.toString(),
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

        Logger.log(`Downloading and extracting repository ${repositoryName}' commit '${sha}'`, ReportsService.name)
        const tmpFolder: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.TMP_FOLDER_PATH)
        const extractedDir = `${tmpFolder}/${uuidv4()}`
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
            throw e
        }

        new Promise<void>(async () => {
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

            await this.uploadRepositoryFilesToSCS(report, extractedDir, kysoConfigFile, files, isNew)
        })

        return report
    }

    public async downloadGithubRepo(report: Report, repository: any, sha: string, userAccount: UserAccount): Promise<void> {
        Logger.log(`Downloading and extrating repository ${report.sluglified_name}' commit '${sha}'`, ReportsService.name)
        report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Processing } })

        const tmpFolder: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.TMP_FOLDER_PATH)
        const extractedDir = `${tmpFolder}/${uuidv4()}`
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
        try {
            const result = await this.normalizeFilePaths(report, filePaths)
            files = result.files
            kysoConfigFile = result.kysoConfigFile
            Logger.log(`Downloaded ${files.length} files from repository ${report.sluglified_name}' commit '${sha}'`, ReportsService.name)
        } catch (e) {
            await this.deleteReport(report.id)
            return null
        }
        Logger.log(`Downloaded ${files.length} files from repository ${report.sluglified_name}' commit '${sha}'`, ReportsService.name)

        await this.uploadRepositoryFilesToSCS(report, extractedDir, kysoConfigFile, files, false)
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
            report = new Report(
                slugify(bitbucketRepository.name),
                bitbucketRepository.id,
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

        const desiredCommit: string = branch && branch.length > 0 ? branch : bitbucketRepository.defaultBranch
        const tmpFolder: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.TMP_FOLDER_PATH)
        const extractedDir = `${tmpFolder}/${uuidv4()}`
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
            zip.extractAllTo(tmpFolder, true)
            moveSync(`${tmpFolder}/${zip.getEntries()[0].entryName}`, extractedDir, { overwrite: true })
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
        try {
            const result = await this.normalizeFilePaths(report, filePaths)
            files = result.files
            kysoConfigFile = result.kysoConfigFile
            Logger.log(`Downloaded ${files.length} files from repository ${repositoryName}' commit '${desiredCommit}'`, ReportsService.name)
        } catch (e) {
            await this.deleteReport(report.id)
            throw e
        }

        new Promise<void>(async () => {
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

            await this.uploadRepositoryFilesToSCS(report, extractedDir, kysoConfigFile, files, isNew)
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
            report = new Report(
                slugify(gitlabRepository.name),
                gitlabRepository.id.toString(),
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

        const desiredCommit: string = branch && branch.length > 0 ? branch : gitlabRepository.defaultBranch
        const tmpFolder: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.TMP_FOLDER_PATH)
        const extractedDir = `${tmpFolder}/${uuidv4()}`
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
            zip.extractAllTo(tmpFolder, true)
            moveSync(`${tmpFolder}/${zip.getEntries()[0].entryName}`, extractedDir, { overwrite: true })
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
        try {
            const result = await this.normalizeFilePaths(report, filePaths)
            files = result.files
            kysoConfigFile = result.kysoConfigFile
            Logger.log(`Downloaded ${files.length} files from repository ${repositoryId}' commit '${desiredCommit}'`, ReportsService.name)
        } catch (e) {
            await this.deleteReport(report.id)
            return null
        }

        new Promise<void>(async () => {
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

            await this.uploadRepositoryFilesToSCS(report, extractedDir, kysoConfigFile, files, isNew)
        })

        return report
    }

    public async downloadBitbucketRepo(report: Report, repositoryName: any, desiredCommit: string, userAccount: UserAccount): Promise<void> {
        Logger.log(`Downloading and extrating repository ${report.sluglified_name}' commit '${desiredCommit}'`, ReportsService.name)
        report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Processing } })
        const tmpFolder: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.TMP_FOLDER_PATH)
        const extractedDir = `${tmpFolder}/${uuidv4()}`
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
        try {
            const result = await this.normalizeFilePaths(report, filePaths)
            files = result.files
            kysoConfigFile = result.kysoConfigFile
            Logger.log(`Downloaded ${files.length} files from repository ${report.sluglified_name}' commit '${desiredCommit}'`, ReportsService.name)
        } catch (e) {
            await this.deleteReport(report.id)
            return null
        }
        Logger.log(`Downloaded ${files.length} files from repository ${report.sluglified_name}' commit '${desiredCommit}'`, ReportsService.name)

        await this.uploadRepositoryFilesToSCS(report, extractedDir, kysoConfigFile, files, false)
    }

    public async downloadGitlabRepo(report: Report, repositoryName: any, desiredCommit: string, userAccount: UserAccount): Promise<void> {
        Logger.log(`Downloading and extrating repository ${report.sluglified_name}' commit '${desiredCommit}'`, ReportsService.name)
        report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Processing } })
        const tmpFolder: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.TMP_FOLDER_PATH)
        const extractedDir = `${tmpFolder}/${uuidv4()}`
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
        try {
            const result = await this.normalizeFilePaths(report, filePaths)
            files = result.files
            kysoConfigFile = result.kysoConfigFile
            Logger.log(`Downloaded ${files.length} files from repository ${report.sluglified_name}' commit '${desiredCommit}'`, ReportsService.name)
        } catch (e) {
            await this.deleteReport(report.id)
            return null
        }
        Logger.log(`Downloaded ${files.length} files from repository ${report.sluglified_name}' commit '${desiredCommit}'`, ReportsService.name)

        await this.uploadRepositoryFilesToSCS(report, extractedDir, kysoConfigFile, files, false)
    }

    private async normalizeFilePaths(
        report: Report,
        filePaths: string[],
    ): Promise<{ files: { name: string; filePath: string }[]; kysoConfigFile: KysoConfigFile; directoriesToRemove: string[] }> {
        // Normalize file paths
        const relativePath: string = filePaths[0]
        const files: { name: string; filePath: string }[] = []
        let kysoConfigFile: KysoConfigFile = null
        let kysoFileName: string = null
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
                kysoFileName = fileName
                try {
                    kysoConfigFile = JSON.parse(readFileSync(filePath, 'utf8')) as KysoConfigFile
                } catch (e) {
                    report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                    Logger.error(`Report ${report.id} ${report.sluglified_name}: Could not parse kyso.json file`, ReportsService.name)
                    throw new PreconditionFailedException(`Could not parse kyso.json file`, ReportsService.name)
                }
            } else if (fileName === 'kyso.yml' || fileName === 'kyso.yaml') {
                kysoFileName = fileName
                try {
                    kysoConfigFile = jsYaml.load(readFileSync(filePath, 'utf8')) as KysoConfigFile
                } catch (e) {
                    report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
                    Logger.error(`Report ${report.id} ${report.sluglified_name}: Could not parse ${fileName} file`, ReportsService.name)
                    throw new PreconditionFailedException(`Could not parse ${fileName} file`)
                }
            }
            files.push({ name: fileName, filePath: filePath })
        }
        if (!kysoConfigFile) {
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
            Logger.error(`Report ${report.id} ${report.sluglified_name}: Repository does not contain a kyso.{json,yml,yaml} config file`, ReportsService.name)
            throw new PreconditionFailedException(`Repository does not contain a kyso.{json,yml,yaml} config file`)
        }
        const { valid, message } = KysoConfigFile.isValid(kysoConfigFile)
        if (!valid) {
            Logger.error(`Kyso config file is not valid: ${message}`, ReportsService.name)
            throw new PreconditionFailedException(`Kyso config file is not valid: ${message}`)
        }
        return { files, kysoConfigFile, directoriesToRemove }
    }

    private async uploadRepositoryFilesToSCS(
        report: Report,
        tmpDir: string,
        kysoConfigFile: KysoConfigFile,
        files: { name: string; filePath: string }[],
        isNew: boolean,
    ): Promise<void> {
        const organization: Organization = await this.organizationsService.getOrganization({
            filter: {
                sluglified_name: kysoConfigFile.organization,
            },
        })
        if (!organization) {
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
            Logger.error(`Report ${report.id} ${report.sluglified_name}: Organization ${kysoConfigFile.team} does not exist`, ReportsService.name)
            return
        }

        const team: Team = await this.teamsService.getTeam({ filter: { sluglified_name: kysoConfigFile.team, organization_id: organization.id } })
        if (!team) {
            report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Failed } })
            Logger.error(`Report ${report.id} ${report.sluglified_name}: Team ${kysoConfigFile.team} does not exist`, ReportsService.name)
            return
        }

        // fix kyso-ui#551-556
        this.preprocessHtmlFiles(tmpDir)
        // end fix
        
        let mainFile = null
        if (kysoConfigFile?.main && kysoConfigFile.main.length > 0) {
            mainFile = kysoConfigFile.main
        }
        let reportType = null
        if (kysoConfigFile?.type && kysoConfigFile.type.length > 0) {
            reportType = kysoConfigFile.type
        } else if (report.report_type) {
            reportType = report.report_type
        }
        report = await this.provider.update(
            { _id: this.provider.toObjectId(report.id) },
            {
                $set: {
                    status: ReportStatus.Processing,
                    team_id: team.id,
                    title: kysoConfigFile.title || report.title,
                    main_file: mainFile || report?.main_file || null,
                    report_type: reportType,
                },
            },
        )

        const lastVersion: number = await this.getLastVersionOfReport(report.id)
        const version = lastVersion + 1

        const reportPath: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.REPORT_PATH)
        const extractedDir = join(reportPath, `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}`)
        moveSync(tmpDir, extractedDir, { overwrite: true })

        if (isNew) {
            await this.checkReportTags(report.id, kysoConfigFile.tags)
        }

        Logger.log(`Report '${report.id} ${report.sluglified_name}': Uploading files to Ftp...`, ReportsService.name)
        await this.uploadReportToFtp(report.id, extractedDir)

        // Get all report files
        for (let i = 0; i < files.length; i++) {
            files[i].filePath = files[i].filePath.replace(tmpDir, extractedDir)
            const originalName: string = files[i].name
            const sha: string = sha256File(files[i].filePath)
            const size: number = statSync(files[i].filePath).size
            const path_scs = `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}/${originalName}`
            let reportFile: File = new File(report.id, originalName, path_scs, size, sha, version)
            reportFile = await this.filesMongoProvider.create(reportFile)
            if (kysoConfigFile?.preview && originalName === kysoConfigFile.preview) {
                const s3Client: S3Client = await this.getS3Client()
                const s3Bucket = await this.kysoSettingsService.getValue(KysoSettingsEnum.AWS_S3_BUCKET)
                const key = `${uuidv4()}${extname(originalName)}`
                await s3Client.send(
                    new PutObjectCommand({
                        Bucket: s3Bucket,
                        Key: key,
                        Body: readFileSync(files[i].filePath),
                    }),
                )
                const preview_picture = `https://${s3Bucket}.s3.amazonaws.com/${key}`
                report.preview_picture = preview_picture
                report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { preview_picture: preview_picture } })
            }
        }

        let tmpFiles: string[] = await this.getFilePaths(extractedDir)
        // Remove '/reportPath' from the paths
        tmpFiles = tmpFiles.map((file: string) => file.replace(reportPath, ''))

        const kysoIndexerApi: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.KYSO_INDEXER_API_BASE_URL)
        const pathToIndex: string = `${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${version}`

        axios.get(`${kysoIndexerApi}/api/index?pathToIndex=${pathToIndex}`).then(
            () => {},
            (err) => {
                Logger.warn(`${pathToIndex} was not indexed properly`, err)
            },
        )

        // writeFileSync(join(reportPath, `/${report.id}.indexer`), tmpFiles.join('\n'))

        report = await this.provider.update({ _id: this.provider.toObjectId(report.id) }, { $set: { status: ReportStatus.Imported } })
        Logger.log(`Report '${report.id} ${report.sluglified_name}' imported`, ReportsService.name)

        await this.sendNewReportMail(report, team, organization, isNew)
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
            const tmpFolder: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.TMP_FOLDER_PATH)
            Logger.log('Extracting Github files to ' + tmpFolder)
            zip.extractAllTo(tmpFolder, true)
            Logger.log('Extraction finished')
            Logger.log(`Moving between ${tmpFolder}/${zip.getEntries()[0].entryName} and ${extractedDir}`)
            moveSync(`${tmpFolder}/${zip.getEntries()[0].entryName}`, extractedDir, { overwrite: true })
            Logger.log(`Moving finished`)
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

    public async pullReport(token: Token, reportName: string, teamName: string, version: number | null, response: any): Promise<void> {
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

        this.returnZippedReport(report, version, response)
    }

    public async downloadReport(reportId: string, version: number | null, response: any): Promise<void> {
        const report: Report = await this.getReportById(reportId)
        if (!report) {
            response.status(404).send(`Report '${reportId}' not found`)
            return
        }
        this.returnZippedReport(report, version, response)
    }

    private async returnZippedReport(report: Report, version: number | null, response: any): Promise<void> {
        const filter: any = { report_id: report.id }
        if (version) {
            filter.version = version
        } else {
            filter.version = await this.getLastVersionOfReport(report.id)
        }
        const reportFiles: File[] = await this.filesMongoProvider.read({ filter })
        if (reportFiles.length === 0) {
            response.status(404).send(`Report '${report.sluglified_name}' does not have version '${filter.version}'`)
            return
        }

        const zip: AdmZip = new AdmZip()
        Logger.log(`Report '${report.sluglified_name}': downloading ${reportFiles.length} files from Ftp...`, ReportsService.name)
        const team: Team = await this.teamsService.getTeamById(report.team_id)
        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
        const client: Client = await this.sftpService.getClient()
        const sftpDestinationFolder = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_DESTINATION_FOLDER)
        const destinationPath = join(
            sftpDestinationFolder,
            `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}/${filter.version}`,
        )
        const existsPath: boolean | string = await client.exists(destinationPath)
        if (!existsPath) {
            Logger.log(`Directory ${destinationPath} does not exist. Creating...`, ReportsService.name)
            return
        }
        const tmpFolder: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.TMP_FOLDER_PATH)
        const localPath = `${tmpFolder}/${report.id}`
        if (!existsSync(localPath)) {
            Logger.log(`LOCAL folder '${localPath}' not found. Creating...`, ReportsService.name)
            mkdirSync(localPath, { recursive: true })
            Logger.log(`LOCAL folder '${localPath}' created.`, ReportsService.name)
        }
        const result = await client.downloadDir(destinationPath, localPath)
        Logger.log(result, ReportsService.name)
        zip.addLocalFolder(localPath)

        response.set('Content-Disposition', `attachment; filename=${report.id}.zip`)
        response.set('Content-Type', 'application/zip')
        // response.send(zip.toBuffer())
        // Logger.log(`Report '${report.sluglified_name}': zip sent to user`, ReportsService.name)
        const zipFilePath = join(localPath, `${report.id}.zip`)
        zip.writeZip(zipFilePath)
        response.download(zipFilePath, `${report.id}.zip`, () => {
            Logger.log(`Report '${report.sluglified_name}': zip sent to user`, ReportsService.name)
            rmSync(localPath, { recursive: true, force: true })
            Logger.log(`Report '${report.sluglified_name}': LOCAL folder '${localPath}' deleted`, ReportsService.name)
        })
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
                    id: justFile.id,
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
            const getDeepChild = (element: any) => {
                if (element?.children && element.children.length > 0) {
                    return getDeepChild(element.children[0])
                }
                return [element]
            }
            result = getDeepChild(result[0].children[0])
        }

        const tree: GithubFileHash[] = []
        result.forEach((element: any) => {
            const file: File = reportFiles.find((f: File) => f.id === element.id)
            if (element.children.length > 0) {
                // Directory
                tree.push({
                    id: null,
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
                    id: file.id,
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
            const client: Client = await this.sftpService.getClient()
            const sftpDestinationFolder = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_DESTINATION_FOLDER)
            const destinationPath = join(sftpDestinationFolder, reportFile.path_scs)
            const existsPath: boolean | string = await client.exists(destinationPath)
            if (!existsPath) {
                return null
            }
            return (await client.get(destinationPath)) as Buffer
        } catch (e) {
            Logger.error(`An error occurred while downloading file '${reportFile.name}' from SCS`, e, ReportsService.name)
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

    private async preprocessHtmlFiles(sourcePath: string) {
        const foundFiles = glob.sync(sourcePath + '/**/*.htm*')
        console.log(foundFiles)
        
        const result = replaceStringInFilesSync({
            files: foundFiles,
            from: '<head>',
            to: `
                <head>
                <meta charset="utf-8" />
                <script src="https://cdnjs.cloudflare.com/ajax/libs/require.js/2.1.10/require.min.js"></script>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.5/MathJax.js?config=TeX-AMS-MML_SVG"></script><script type="text/javascript">if (window.MathJax) {MathJax.Hub.Config({SVG: {font: "STIX-Web"}});}</script>
                <script src="/static/iframeResizer.contentWindow.js"></script>
                <script type="text/javascript">window.PlotlyConfig = {MathJaxConfig: 'local'};</script>
                <script type="text/javascript">
                  window.PlotlyConfig = {MathJaxConfig: 'local'}
                    if (window.MathJax) {MathJax.Hub.Config({SVG: {font: "STIX-Web"}});}
                    if (typeof require !== 'undefined') {
                      require.undef("plotly");
                      requirejs.config({
                        paths: {
                          'plotly': ['https://cdn.plot.ly/plotly-latest.min']
                        }
                      });
                      require(['plotly'], function(Plotly) {
                        window._Plotly = Plotly;
                      });
                    }
                </script>
                <script>
                    window.addEventListener('message', function(event) {
                      var output = document.getElementsByClassName('output_raw')[0]
                      try {
                        var jsonMessage = JSON.parse(event.data)
                        if (jsonMessage.__fs) {
                          // Discard message which contain __fs
                          return
                        }
                      } catch (e) {
                        // The incoming data does not have to be in form of a JSON, we can ignore this error
                      }
                      if (event.data.startsWith('[scrollDown]')) {
                        setTimeout(function(){
                          const element = document.getElementsByClassName('output')[0];
                          element.scrollTop = element.scrollHeight;
                          }, 100);
                        return;
                      }
                      if (!event.data.startsWith('[iFrameSizer]')) {
                        output.innerHTML = event.data
                      }
                    });
                  </script>
                  
                  <link rel='stylesheet' href='https://fonts.googleapis.com/css?family=Roboto+Mono:400,500&amp;amp;display=swap' />
        
                  <style>
                    body {
                      font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
                      font-size: 12px;
                      color: #171616;
                      line-height: 1.6;
                      margin: 1px;
                      padding: 0;
                      padding-bottom: 15px;
                    }
                 
                    .dataframe tbody tr th:only-of-type {
                      vertical-align: middle;
                    }
        
                    .dataframe tbody tr th {
                      vertical-align: top;
                    }
        
                    .dataframe thead th {
                      text-align: left!important;
                    }
        
                    table {
                      min-width: 100%;
                      box-sizing: border-box;
                      display: block-inline;
                      border-collapse: collapse;
                      border-radius: 3px;
                      border-style: hidden;
                      box-shadow: inset 0 0 0 1px #dfe5eb;
                      text-align: left;
                      transform: scale(1);
                      -webkit-transform: scale(1);
                      -moz-transform: scale(1);
                      box-shadow: inset 0 0 0 1px #dfe5eb;;
                      -webkit-box-shadow: inset 0 0 0 1px #dfe5eb;;
                      -moz-box-shadow: inset 0 0 0 1px #dfe5eb;;
                    }
        
                    thead {
                      box-shadow: inset 0 0 0 1px #dfe5eb;
                      border-top-left-radius: 3px;
                      border-top-right-radius: 3px;
                    }
        
                    table tr:nth-of-type(2n) {
                      background: #f4f6f8;
                      box-shadow: inset 0 0 0 1px #dfe5eb;
                    }
        
                    table th {
                      padding: 5px 5px 5px 25px;
                      border: 0;
                      text-align: right;
                      white-space: nowrap;
                      text-overflow: ellipsis;
                    }
        
                    table td {
                      padding: 5px 5px 5px 25px;
                      border: 0;
                      text-align: left;
                      white-space: nowrap;
                      text-overflow: ellipsis;
                    }
                  </style>
            `
        })
        
    }

    private async uploadReportToFtp(reportId: string, sourcePath: string): Promise<void> {
        // fix kyso-ui#551-556
        this.preprocessHtmlFiles(sourcePath)
        // end fix
        
        const report: Report = await this.getReportById(reportId)
        let version: number = await this.getLastVersionOfReport(reportId)
        version = Math.max(1, version)
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
            Logger.log(`Created directory ${destinationPath} in ftp`, ReportsService.name)
        }

         

        const result: string = await client.uploadDir(sourcePath, destinationPath)
        Logger.log(result, ReportsService.name)
        await client.end()
    }

    private async deleteReportFromFtp(reportId: string): Promise<void> {
        const report: Report = await this.getReportById(reportId)
        try {
            const team: Team = await this.teamsService.getTeamById(report.team_id)
            if (!team) {
                Logger.error(`Report '${report.id} - ${report.sluglified_name}' does not have a team`, ReportsService.name)
                return
            }
            const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
            const client: Client = await this.sftpService.getClient()
            const sftpDestinationFolder = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_DESTINATION_FOLDER)
            const destinationPath = join(sftpDestinationFolder, `/${organization.sluglified_name}/${team.sluglified_name}/reports/${report.sluglified_name}`)
            const existsPath: boolean | string = await client.exists(destinationPath)
            if (!existsPath) {
                Logger.log(`Directory ${destinationPath} does not exist. Creating...`, ReportsService.name)
                return
            }
            const result: string = await client.rmdir(destinationPath, true)
            Logger.log(`Deleted directory ${destinationPath} of report ${report.id} ${report.title} from ftp`, ReportsService.name)
            Logger.log(result, ReportsService.name)
            await client.end()
        } catch (e) {
            Logger.error(`Error deleting report ${report.id} ${report.title} from SFTP`, e, ReportsService.name)
        }
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
