import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
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
    LoginProviderEnum,
    Organization,
    OrganizationMemberJoin,
    PinnedReport,
    Report,
    ReportDTO,
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
import { Injectable, Logger, PreconditionFailedException, Provider } from '@nestjs/common'
import { Octokit } from '@octokit/rest'
import * as AdmZip from 'adm-zip'
import axios, { AxiosResponse } from 'axios'
import { lstatSync, readFileSync, rmSync, statSync, unlinkSync } from 'fs'
import * as glob from 'glob'
import * as jsYaml from 'js-yaml'
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
        // setTimeout(() => this.pullReport('61f3fc7e1f35752b661ddd3c'), 500)
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

        createReportDto.name = slugify(createReportDto.name)

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

        const name: string = slugify(createKysoReportDTO.title)
        const reports: Report[] = await this.provider.read({ filter: { name, team_id: team.id } })
        const reportFiles: File[] = []
        let report: Report = null
        if (reports.length > 0) {
            // Existing report
            report = reports[0]
            Logger.log(`Checking files of existing report '${report.name}'`, ReportsService.name)
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
        const repositoryResponse = await octokit.repos.get({
            owner: userAccount.username,
            repo: repositoryName,
        })
        if (repositoryResponse.status !== 200) {
            throw new PreconditionFailedException(`Repository ${repositoryName} does not exist`)
        }
        const repository = repositoryResponse.data

        Logger.log(`Getting last commit of repository '${repositoryName}'...`, ReportsService.name)
        const commitsResponse = await octokit.repos.listCommits({
            owner: userAccount.username,
            repo: repositoryName,
            per_page: 1,
        })
        if (commitsResponse.status !== 200) {
            throw new PreconditionFailedException(`GitHub API returned status ${commitsResponse.status}`)
        }
        const sha: string = commitsResponse.data[0].sha

        Logger.log(`Downloading and extrating repository ${repositoryName}' commit '${sha}'`, ReportsService.name)
        const extractedDir = `/tmp/${uuidv4()}`
        const downloaded: boolean = await this.downloadGithubFiles(sha, extractedDir, repository, userAccount.accessToken)
        if (!downloaded) {
            throw new PreconditionFailedException(`Could not download repository ${repositoryName} commit ${sha}`, ReportsService.name)
        }
        Logger.log(`Downloaded repository ${repositoryName}' commit '${sha}'`, ReportsService.name)

        const filePaths: string[] = await this.getFilePaths(extractedDir)
        if (filePaths.length < 2) {
            throw new PreconditionFailedException(`Repository ${repositoryName} does not contain any files`, ReportsService.name)
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
                        throw new PreconditionFailedException(`Kyso config file is not valid`)
                    }
                } catch (e) {
                    throw new PreconditionFailedException(`Could not parse kyso.json file`, ReportsService.name)
                }
            } else if (fileName === 'kyso.yml') {
                try {
                    kysoConfigFile = jsYaml.load(readFileSync(filePath, 'utf8')) as KysoConfigFile
                    if (!KysoConfigFile.isValid(kysoConfigFile)) {
                        throw new PreconditionFailedException(`Kyso config file is not valid`)
                    }
                } catch (e) {
                    throw new PreconditionFailedException(`Could not parse kyso.yml file`, ReportsService.name)
                }
                files.push({ name: fileName, filePath: filePath })
            }
        }
        if (!kysoConfigFile) {
            throw new PreconditionFailedException(`Repository ${repositoryName} does not contain a kyso.{json,yml} config file`, ReportsService.name)
        }
        Logger.log(`Downloaded ${files.length} files from repository ${repositoryName}' commit '${sha}'`, ReportsService.name)

        const team: Team = await this.teamsService.getTeam({ filter: { name: kysoConfigFile.team } })
        if (!team) {
            throw new PreconditionFailedException(`Team ${kysoConfigFile.team} does not exist`)
        }
        const belongsToTeam: boolean = await this.teamsService.userBelongsToTeam(team.id, user.id)
        if (!isGlobalAdmin && !belongsToTeam) {
            throw new PreconditionFailedException(`User ${user.nickname} is not a member of team ${team.name}`)
        }

        const reports: Report[] = await this.provider.read({ filter: { name: repository.name, team_id: team.id, user_id: user.id } })
        let reportFiles: File[] = []
        let report: Report = null
        if (reports.length > 0) {
            // Existing report
            report = reports[0]
            Logger.log(`Report '${report.name}' already imported`, ReportsService.name)
        } else {
            const webhook = await this.createWebhook(octokit, userAccount.username, repository.name)
            report = new Report(
                repository.name,
                repository.id.toString(),
                webhook.id.toString(),
                RepositoryProvider.GITHUB,
                repository.owner.login,
                repository.default_branch,
                kysoConfigFile.importPath,
                0,
                false,
                repository.description,
                user.id,
                team.id,
                kysoConfigFile.title,
                [],
            )
            report = await this.provider.create(report)
            Logger.log(`New report '${report.name}'`, ReportsService.name)
        }

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

        Logger.log(`Report '${report.name}' imported`, ReportsService.name)
        return report
    }

    private async createWebhook(octokit: Octokit, username: string, repositoryName: string) {
        try {
            let hookUrl = `${process.env.SELF_URL}/v1/hooks/github`
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
}
