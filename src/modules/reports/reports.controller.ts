import {
    Comment,
    File,
    GithubBranch,
    GithubFileHash,
    GlobalPermissionsEnum,
    HEADER_X_KYSO_ORGANIZATION,
    HEADER_X_KYSO_TEAM,
    NormalizedResponseDTO,
    Organization,
    Report,
    ReportDTO,
    ReportPermissionsEnum,
    Team,
    TeamVisibilityEnum,
    Token,
    UpdateReportRequestDTO,
} from '@kyso-io/kyso-model'
import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Headers,
    Logger,
    NotFoundException,
    Param,
    Patch,
    Post,
    PreconditionFailedException,
    Query,
    Req,
    Res,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ObjectId } from 'mongodb'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Autowired } from '../../decorators/autowired'
import { Public } from '../../decorators/is-public'
import { GenericController } from '../../generic/controller.generic'
import { QueryParser } from '../../helpers/queryParser'
import slugify from '../../helpers/slugify'
import { CurrentToken } from '../auth/annotations/current-token.decorator'
import { Permission } from '../auth/annotations/permission.decorator'
import { AuthService } from '../auth/auth.service'
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { SolvedCaptchaGuard } from '../auth/guards/solved-captcha.guard'
import { CommentsService } from '../comments/comments.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { RelationsService } from '../relations/relations.service'
import { TeamsService } from '../teams/teams.service'
import { ReportsService } from './reports.service'

@ApiExtraModels(Report, NormalizedResponseDTO)
@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@ApiHeader({
    name: HEADER_X_KYSO_ORGANIZATION,
    description: 'active organization (i.e: lightside)',
    required: true,
})
@ApiHeader({
    name: HEADER_X_KYSO_TEAM,
    description: 'active team (i.e: protected-team)',
    required: true,
})
export class ReportsController extends GenericController<Report> {
    @Autowired({ typeName: 'CommentsService' })
    private commentsService: CommentsService

    @Autowired({ typeName: 'ReportsService' })
    private reportsService: ReportsService

    @Autowired({ typeName: 'RelationsService' })
    private relationsService: RelationsService

    @Autowired({ typeName: 'TeamsService' })
    private teamsService: TeamsService

    @Autowired({ typeName: 'OrganizationsService' })
    private organizationsService: OrganizationsService

    constructor() {
        super()
    }

    @Get()
    @UseGuards(PermissionsGuard)
    @ApiOperation({
        summary: `Search and fetch reports`,
        description: `By passing the appropiate parameters you can fetch and filter the reports available to the authenticated user.<br />
         **This endpoint supports filtering**. Refer to the Report schema to see available options.`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Reports matching criteria`,
        type: ReportDTO,
        isArray: true,
    })
    async getReports(@CurrentToken() token: Token, @Req() req): Promise<NormalizedResponseDTO<ReportDTO[]>> {
        const query = QueryParser.toQueryObject(req.url)
        if (!query.sort) query.sort = { created_at: -1 }
        if (!query.filter) query.filter = {}

        if (!query.filter.hasOwnProperty('team_id') || query.filter.team_id == null || query.filter.team_id === '') {
            const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id)
            query.filter.team_id = { $in: teams.map((team: Team) => team.id) }
            if (token.permissions?.global && token.permissions.global.includes(GlobalPermissionsEnum.GLOBAL_ADMIN)) {
                delete query.filter.team_id
            }
            if (query?.filter?.organization_id) {
                const organizationTeams: Team[] = await this.teamsService.getTeams({ filter: { organization_id: query.filter.organization_id } })
                query.filter.team_id = { $in: organizationTeams.map((team: Team) => team.id) }
                delete query.filter.organization_id
            }
        }

        if (query?.filter?.$text) {
            /*const tags: Tag[] = await this.tagsService.getTags({ filter: { $text: query.filter.$text } })
            const tagAssigns: TagAssign[] = await this.tagsService.getTagAssignsOfTags(
                tags.map((tag: Tag) => tag.id),
                EntityEnum.REPORT,
            )*/
            const newFilter = { ...query.filter }

            newFilter.$or = [
                // {
                //     $text: newFilter.$text,
                // },
                {
                    sluglified_name: { $regex: `${query.filter.$text.$search}`, $options: 'i' },
                },
                {
                    title: { $regex: `${query.filter.$text.$search}`, $options: 'i' },
                },
                {
                    description: { $regex: `${query.filter.$text.$search}`, $options: 'i' },
                } /*,
                {
                    _id: { $in: tagAssigns.map((tagAssign: TagAssign) => new ObjectId(tagAssign.entity_id)) },
                },*/,
            ]
            delete newFilter.$text
            query.filter = newFilter
        }

        if (query?.filter?.sluglified_name && !isNaN(query.filter.sluglified_name)) {
            query.filter.sluglified_name = query.filter.sluglified_name.toString()
        }

        const reports: Report[] = await this.reportsService.getReports(query)
        let reportsDtos: ReportDTO[] = []
        if (reports.length > 0) {
            reportsDtos = await Promise.all(reports.map((report: Report) => this.reportsService.reportModelToReportDTO(report, token.id)))
            try {
                await this.reportsService.increaseViews({ _id: { $in: reportsDtos.map((reportDto: ReportDTO) => new ObjectId(reportDto.id)) } })
            } catch (ex) {
                console.log('Error increasing views')
            }
        }
        reportsDtos.forEach((reportDto: ReportDTO) => {
            reportDto.views++
        })
        const relations = await this.relationsService.getRelations(reports, 'report', { Author: 'User' })
        return new NormalizedResponseDTO(reportsDtos, relations)
    }

    @Get('/pinned')
    @UseGuards(PermissionsGuard)
    @ApiOperation({
        summary: `Get pinned reports for a user`,
        description: `Allows fetching pinned reports of a specific user passing its id`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `All the pinned reports of a user`,
        type: ReportDTO,
    })
    @ApiParam({
        name: 'userId',
        required: true,
        description: 'Id of the owner of the report to fetch',
        schema: { type: 'string' },
    })
    @Permission([ReportPermissionsEnum.READ])
    async getPinnedReportsForUser(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<ReportDTO[]>> {
        const reports: Report[] = await this.reportsService.getPinnedReportsForUser(token.id)
        let reportsDtos: ReportDTO[] = []
        if (reports.length > 0) {
            reportsDtos = await Promise.all(reports.map((report: Report) => this.reportsService.reportModelToReportDTO(report, token.id)))
            await this.reportsService.increaseViews({ _id: { $in: reports.map((report: Report) => new ObjectId(report.id)) } })
        }
        reportsDtos.forEach((reportDto: ReportDTO) => {
            reportDto.views++
        })
        const relations = await this.relationsService.getRelations(reports, 'report', { Author: 'User' })
        return new NormalizedResponseDTO(reportsDtos, relations)
    }

    @Get('/:reportId')
    @ApiOperation({
        summary: `Get a report`,
        description: `Allows fetching content of a specific report passing its id`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Report matching id`,
        type: ReportDTO,
    })
    @ApiParam({
        name: 'reportId',
        required: true,
        description: 'Id of the report to fetch',
        schema: { type: 'string' },
    })
    async getReport(
        @Headers(HEADER_X_KYSO_ORGANIZATION) organizationName: string,
        @Headers(HEADER_X_KYSO_TEAM) teamName: string,
        @CurrentToken() token: Token,
        @Param('reportId') reportId: string,
    ): Promise<NormalizedResponseDTO<ReportDTO>> {
        await this.reportsService.increaseViews({ _id: new ObjectId(reportId) })
        const report: Report = await this.reportsService.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('Report not found')
        }
        const team: Team = await this.teamsService.getTeamById(report.team_id)
        if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
            const hasPermissions: boolean = await AuthService.hasPermissions(token, [ReportPermissionsEnum.READ], teamName, organizationName)
            if (!hasPermissions) {
                throw new ForbiddenException('You do not have permissions to access this report')
            }
        }
        const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' })
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id)
        return new NormalizedResponseDTO(reportDto, relations)
    }

    @Get('/:reportId/comments')
    @ApiOperation({
        summary: `Get comments of a report`,
        description: `By passing in the appropriate options you can see all the comments of a report`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Comments of the specified report`,
        type: Comment,
        isArray: true,
    })
    @ApiParam({
        name: 'reportId',
        required: true,
        description: 'Id of the report to fetch',
        schema: { type: 'string' },
    })
    async getComments(
        @Headers(HEADER_X_KYSO_ORGANIZATION) organizationName: string,
        @Headers(HEADER_X_KYSO_TEAM) teamName: string,
        @CurrentToken() token: Token,
        @Param('reportId') reportId: string,
        @Req() req,
    ): Promise<NormalizedResponseDTO<Comment[]>> {
        const report: Report = await this.reportsService.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('Report not found')
        }
        const team: Team = await this.teamsService.getTeamById(report.team_id)
        if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
            const hasPermissions: boolean = await AuthService.hasPermissions(token, [ReportPermissionsEnum.READ], teamName, organizationName)
            if (!hasPermissions) {
                throw new ForbiddenException('You do not have permissions to access this report')
            }
        }
        const query = QueryParser.toQueryObject(req.url)
        if (!query.sort) {
            query.sort = { created_at: -1 }
        }
        const comments: Comment[] = await this.commentsService.getComments({ filter: { report_id: reportId }, sort: query.sort })
        const relations = await this.relationsService.getRelations(comments, 'comment')
        return new NormalizedResponseDTO(
            comments.filter((comment: Comment) => !comment.comment_id),
            relations,
        )
    }

    @Get('/:reportName/:teamId/exists')
    @UseGuards(PermissionsGuard)
    @ApiOperation({
        summary: `Check if report exists`,
        description: `Allows checking if a report exists passing its name and team name`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Report matching name and team name`,
        type: Boolean,
    })
    @ApiParam({
        name: 'reportName',
        required: true,
        description: 'Name of the report to check',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'teamId',
        required: true,
        description: 'Id of the team to check',
        schema: { type: 'string' },
    })
    @Permission([ReportPermissionsEnum.READ])
    async checkReport(@Param('reportName') reportName: string, @Param('teamId') teamId: string): Promise<boolean> {
        const report: Report = await this.reportsService.getReport({ filter: { sluglified_name: slugify(reportName), team_id: teamId } })
        return report != null
    }

    @Get('/embedded/:organizationName/:teamName/:reportName')
    @Public()
    @ApiOperation({
        summary: `Get a report`,
        description: `Allows fetching content of a specific report passing its id`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Report matching id`,
        type: ReportDTO,
    })
    @ApiParam({
        name: 'organizationName',
        required: true,
        description: 'Name of the organization to fetch',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'teamName',
        required: true,
        description: 'Name of the team to fetch',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'reportName',
        required: true,
        description: 'Name of the report to fetch',
        schema: { type: 'string' },
    })
    async getEmbeddedReport(
        @CurrentToken() token: Token,
        @Param('organizationName') organizationName: string,
        @Param('teamName') teamName: string,
        @Param('reportName') reportName: string,
    ): Promise<NormalizedResponseDTO<ReportDTO>> {
        const organization: Organization = await this.organizationsService.getOrganization({ filter: { sluglified_name: organizationName } })
        if (!organization) {
            throw new PreconditionFailedException('Organization not found')
        }
        const team: Team = await this.teamsService.getTeam({ filter: { sluglified_name: teamName, organization_id: organization.id } })
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }
        if (!token) {
            if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
                throw new PreconditionFailedException(`Report is not public`)
            }
        } else {
            const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id)
            const index: number = teams.findIndex((t: Team) => t.id === team.id)
            if (index === -1) {
                throw new ForbiddenException('You do not have permissions to access this report')
            }
        }
        const report: Report = await this.reportsService.getReport({ filter: { sluglified_name: reportName, team_id: team.id } })
        if (!report) {
            throw new PreconditionFailedException('Report not found')
        }
        await this.reportsService.increaseViews({ _id: new ObjectId(report.id) })
        report.views++
        const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' })
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, null)
        return new NormalizedResponseDTO(reportDto, relations)
    }

    @Post('/kyso')
    @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Create a new report sending the files`,
        description: `By passing the appropiate parameters you can create a new report referencing a git repository`,
    })
    @ApiResponse({
        status: 201,
        description: `Created report`,
        type: ReportDTO,
    })
    @UseInterceptors(FileInterceptor('file'))
    @Permission([ReportPermissionsEnum.CREATE])
    @Public()
    async createKysoReport(@CurrentToken() token: Token, @UploadedFile() file: Express.Multer.File): Promise<NormalizedResponseDTO<Report>> {
        Logger.log(`Called createKysoReport`)
        if (!file) {
            throw new BadRequestException(`Missing file`)
        }
        const report: Report = await this.reportsService.createKysoReport(token.id, file)
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id)
        const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' })
        return new NormalizedResponseDTO(reportDto, relations)
    }

    @Post('/ui')
    @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Create a new report sending the files`,
        description: `By passing the appropiate parameters you can create a new report referencing a git repository`,
    })
    @ApiResponse({
        status: 201,
        description: `Created report`,
        type: ReportDTO,
    })
    @UseInterceptors(FileInterceptor('file'))
    @Permission([ReportPermissionsEnum.CREATE])
    async createUIReport(@CurrentToken() token: Token, @UploadedFile() file: Express.Multer.File): Promise<NormalizedResponseDTO<Report>> {
        Logger.log(`Called createUIReport`)
        const report: Report = await this.reportsService.createUIReport(token.id, file)
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id)
        const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' })
        return new NormalizedResponseDTO(reportDto, relations)
    }

    @Post('/ui/main-file/:reportId')
    @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Update the main file of the report`,
        description: `By passing the appropiate parameters you can update the main file of report`,
    })
    @ApiResponse({
        status: 201,
        description: `Update the main file of the report`,
        type: ReportDTO,
    })
    @UseInterceptors(FileInterceptor('file'))
    @Permission([ReportPermissionsEnum.EDIT])
    async updateMainFileReport(
        @CurrentToken() token: Token,
        @Param('reportId') reportId: string,
        @UploadedFile() file: any,
    ): Promise<NormalizedResponseDTO<Report>> {
        const report: Report = await this.reportsService.updateMainFileReport(token.id, reportId, file)
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id)
        const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' })
        return new NormalizedResponseDTO(reportDto, relations)
    }

    @Post('/github/:repositoryName')
    @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Create a new report based on github repository`,
        description: `By passing the appropiate parameters you can create a new report referencing a github repository`,
    })
    @ApiResponse({
        status: 201,
        description: `Created report`,
        type: ReportDTO,
    })
    async createReportFromGithubRepository(
        @CurrentToken() token: Token,
        @Param('repositoryName') repositoryName: string,
        @Query('branch') branch: string,
    ): Promise<NormalizedResponseDTO<Report>> {
        Logger.log(`Called createReportFromGithubRepository`)
        const report: Report = await this.reportsService.createReportFromGithubRepository(token.id, repositoryName, branch)
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id)
        const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' })
        return new NormalizedResponseDTO(reportDto, relations)
    }

    @Post('/bitbucket')
    @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Create a new report based on bitbucket repository`,
        description: `By passing the appropiate parameters you can create a new report referencing a bitbucket repository`,
    })
    @ApiResponse({
        status: 201,
        description: `Created report`,
        type: ReportDTO,
    })
    async createReportFromBitbucketRepository(
        @CurrentToken() token: Token,
        @Query('name') name: string,
        @Query('branch') branch: string,
    ): Promise<NormalizedResponseDTO<Report>> {
        if (!name || name.length === 0) {
            throw new PreconditionFailedException('Repository name is required')
        }
        Logger.log(`Called createReportFromBitbucketRepository`)
        const report: Report = await this.reportsService.createReportFromBitbucketRepository(token.id, name, branch)
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id)
        const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' })
        return new NormalizedResponseDTO(reportDto, relations)
    }

    @Post('/gitlab')
    @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Create a new report based on gitlab repository`,
        description: `By passing the appropiate parameters you can create a new report referencing a gitlab repository`,
    })
    @ApiResponse({
        status: 201,
        description: `Created report`,
        type: ReportDTO,
    })
    async createReportFromGitlabRepository(
        @CurrentToken() token: Token,
        @Query('id') id: string,
        @Query('branch') branch: string,
    ): Promise<NormalizedResponseDTO<Report>> {
        Logger.log(`Called createReportFromGitlabRepository`)
        console.log(id)
        const report: Report = await this.reportsService.createReportFromGitlabRepository(token.id, id, branch)
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id)
        const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' })
        return new NormalizedResponseDTO(reportDto, relations)
    }

    @Patch('/:reportId')
    @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Update the specific report`,
        description: `Allows updating content from the specified report`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Specified report data`,
        type: ReportDTO,
    })
    @ApiParam({
        name: 'reportId',
        required: true,
        description: 'Id of the report to update',
        schema: { type: 'string' },
    })
    @ApiBody({ type: UpdateReportRequestDTO })
    @Permission([ReportPermissionsEnum.EDIT])
    async updateReport(
        @CurrentToken() token: Token,
        @Param('reportId') reportId: string,
        @Body() updateReportRequestDTO: UpdateReportRequestDTO,
    ): Promise<NormalizedResponseDTO<ReportDTO>> {
        Logger.log(`Called updateReport`)
        const report: Report = await this.reportsService.updateReport(token.id, reportId, updateReportRequestDTO)
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id)
        const relations = await this.relationsService.getRelations(reportDto, 'report', { Author: 'User' })
        return new NormalizedResponseDTO(report, relations)
    }

    @Delete('/:reportId')
    @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Delete a report`,
        description: `Allows deleting a specific report`,
    })
    @ApiResponse({ status: 204, description: `Report deleted` })
    @ApiParam({
        name: 'reportId',
        required: true,
        description: 'Id of the report to fetch',
        schema: { type: 'string' },
    })
    @Permission([ReportPermissionsEnum.DELETE])
    async deleteReport(@Param('reportId') reportId: string): Promise<NormalizedResponseDTO<Report>> {
        const report: Report = await this.reportsService.deleteReport(reportId)
        return new NormalizedResponseDTO(report)
    }

    @Patch('/:reportId/pin')
    @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Toggles global pin for the specified report`,
        description: `Allows pinning and unpinning of the specified report globally`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Specified report data`,
        type: Report,
    })
    @ApiParam({
        name: 'reportId',
        required: true,
        description: 'Id of the report to toggle global pin',
        schema: { type: 'string' },
    })
    @Permission([ReportPermissionsEnum.GLOBAL_PIN])
    async toggleGlobalPin(@CurrentToken() token: Token, @Param('reportId') reportId: string): Promise<NormalizedResponseDTO<Report>> {
        const report: Report = await this.reportsService.toggleGlobalPin(reportId)
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id)
        const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' })
        return new NormalizedResponseDTO(reportDto, relations)
    }

    @Patch('/:reportId/user-pin')
    @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Toggles the user's pin the specified report`,
        description: `Allows pinning and unpinning of the specified report for a user`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Specified report data`,
        type: Report,
    })
    @ApiParam({
        name: 'reportId',
        required: true,
        description: 'Id of the report to pin',
        schema: { type: 'string' },
    })
    async toggleUserPin(@CurrentToken() token: Token, @Param('reportId') reportId: string): Promise<NormalizedResponseDTO<Report>> {
        const report: Report = await this.reportsService.toggleUserPin(token.id, reportId)
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id)
        const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' })
        return new NormalizedResponseDTO(reportDto, relations)
    }

    @Patch('/:reportId/user-star')
    @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Toggles the user's star of the specified report`,
        description: `Allows starring and unstarring the specified report for a user`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Specified report data`,
        type: Report,
    })
    @ApiParam({
        name: 'reportId',
        required: true,
        description: 'Id of the report to pin',
        schema: { type: 'string' },
    })
    async toggleUserStar(@CurrentToken() token: Token, @Param('reportId') reportId: string): Promise<NormalizedResponseDTO<Report>> {
        const report: Report = await this.reportsService.toggleUserStar(token.id, reportId)
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id)
        const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' })
        return new NormalizedResponseDTO(reportDto, relations)
    }

    @Get('/:reportName/:teamName/pull')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Pull a report from SCS`,
        description: `Pull a report from SCS. This will download all files from SCS in zip format.`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Zip file containing all files of the report`,
        type: Buffer,
    })
    @ApiParam({
        name: 'reportName',
        required: true,
        description: 'Id of the report to pull',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'teamName',
        required: true,
        description: 'Id of the team to pull',
        schema: { type: 'string' },
    })
    async pullReport(
        @Headers(HEADER_X_KYSO_ORGANIZATION) organizationName: string,
        @Headers(HEADER_X_KYSO_TEAM) teamName: string,
        @CurrentToken() token: Token,
        @Param('reportName') reportName: string,
        @Param('teamName') teamNameParam: string,
        @Query('version') versionStr: string,
        @Res() response: any,
    ): Promise<any> {
        const team: Team = await this.teamsService.getTeam({ filter: { sluglified_name: teamName } })
        if (!team) {
            throw new NotFoundException(`Team ${teamName} not found`)
        }
        const report: Report = await this.reportsService.getReport({
            filter: {
                sluglified_name: reportName,
                team_id: team.id,
            },
        })
        if (!report) {
            throw new PreconditionFailedException('Report not found')
        }
        if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
            const hasPermissions: boolean = await AuthService.hasPermissions(token, [ReportPermissionsEnum.READ], teamName, organizationName)
            if (!hasPermissions) {
                throw new ForbiddenException('You do not have permissions to access this report')
            }
        }
        let version: number | null = null
        if (versionStr) {
            try {
                version = parseInt(versionStr, 10)
            } catch (e) {
                Logger.error(`An error occurred while parsing the version`, e, ReportsController.name)
            }
        }
        this.reportsService.pullReport(token, reportName, teamNameParam, version, response)
    }

    @Get('/:reportId/download')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Download a report from SCS`,
        description: `Download a report from SCS. This will download all files from SCS in zip format.`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Zip file containing all files of the report`,
        type: Buffer,
    })
    @ApiParam({
        name: 'reportId',
        required: true,
        description: 'Id of the report to pull',
        schema: { type: 'string' },
    })
    async downloadReport(
        @Headers(HEADER_X_KYSO_ORGANIZATION) organizationName: string,
        @Headers(HEADER_X_KYSO_TEAM) teamName: string,
        @CurrentToken() token: Token,
        @Param('reportId') reportId: string,
        @Query('version') versionStr: string,
        @Res() response: any,
    ): Promise<any> {
        const report: Report = await this.reportsService.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('Report not found')
        }
        const team: Team = await this.teamsService.getTeamById(report.team_id)
        if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
            const hasPermissions: boolean = await AuthService.hasPermissions(token, [ReportPermissionsEnum.READ], teamName, organizationName)
            if (!hasPermissions) {
                throw new ForbiddenException('You do not have permissions to access this report')
            }
        }
        let version: number | null = null
        if (versionStr) {
            try {
                version = parseInt(versionStr, 10)
            } catch (e) {
                Logger.error(`An error occurred while parsing the version`, e, ReportsController.name)
            }
        }
        this.reportsService.downloadReport(reportId, version, response)
    }

    @Get('/:reportId/files')
    @ApiOperation({
        summary: `Get all files of a report`,
        description: `Get all files of a report`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Specified report data`,
        type: File,
    })
    @ApiParam({
        name: 'reportId',
        required: true,
        description: 'Id of the report to fetch',
        schema: { type: 'string' },
    })
    async getReportFiles(
        @Headers(HEADER_X_KYSO_ORGANIZATION) organizationName: string,
        @Headers(HEADER_X_KYSO_TEAM) teamName: string,
        @CurrentToken() token: Token,
        @Param('reportId') reportId: string,
        @Query('version') version: string,
    ): Promise<NormalizedResponseDTO<File>> {
        const report: Report = await this.reportsService.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('Report not found')
        }
        const team: Team = await this.teamsService.getTeamById(report.team_id)
        if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
            const hasPermissions: boolean = await AuthService.hasPermissions(token, [ReportPermissionsEnum.READ], teamName, organizationName)
            if (!hasPermissions) {
                throw new ForbiddenException('You do not have permissions to access this report')
            }
        }
        const files: File[] = await this.reportsService.getReportFiles(reportId, version)
        return new NormalizedResponseDTO(files)
    }

    @Get('/:reportId/versions')
    @ApiOperation({
        summary: `Get all versions of a report`,
        description: `Get all versions of a report`,
    })
    @ApiParam({
        name: 'reportId',
        required: true,
        description: 'Id of the report to fetch',
        schema: { type: 'string' },
    })
    async getReportVersions(
        @Headers(HEADER_X_KYSO_ORGANIZATION) organizationName: string,
        @Headers(HEADER_X_KYSO_TEAM) teamName: string,
        @CurrentToken() token: Token,
        @Param('reportId') reportId: string,
        @Req() req,
    ): Promise<NormalizedResponseDTO<{ version: number; created_at: Date; num_files: number }>> {
        const report: Report = await this.reportsService.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('Report not found')
        }
        const team: Team = await this.teamsService.getTeamById(report.team_id)
        if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
            const hasPermissions: boolean = await AuthService.hasPermissions(token, [ReportPermissionsEnum.READ], teamName, organizationName)
            if (!hasPermissions) {
                throw new ForbiddenException('You do not have permissions to access this report')
            }
        }
        const query = QueryParser.toQueryObject(req.url)
        if (!query.sort) {
            query.sort = { created_at: -1 }
        }
        const versions: any[] = await this.reportsService.getReportVersions(reportId)
        if (query.sort.created_at === 1) {
            versions.sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
        } else {
            versions.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        }
        return new NormalizedResponseDTO(versions)
    }

    @Get('/:reportId/branches')
    @ApiOperation({
        summary: `Get branches of a report`,
        description: `By passing in the appropriate options you can see all the branches of a report`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Branches of the specified report`,
        type: GithubBranch,
        isArray: true,
    })
    @ApiParam({
        name: 'reportId',
        required: true,
        description: 'Id of the report to fetch',
        schema: { type: 'string' },
    })
    async getBranches(
        @Headers(HEADER_X_KYSO_ORGANIZATION) organizationName: string,
        @Headers(HEADER_X_KYSO_TEAM) teamName: string,
        @CurrentToken() token: Token,
        @Param('reportId') reportId: string,
    ): Promise<NormalizedResponseDTO<GithubBranch[]>> {
        const report: Report = await this.reportsService.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('Report not found')
        }
        const team: Team = await this.teamsService.getTeamById(report.team_id)
        if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
            const hasPermissions: boolean = await AuthService.hasPermissions(token, [ReportPermissionsEnum.READ], teamName, organizationName)
            if (!hasPermissions) {
                throw new ForbiddenException('You do not have permissions to access this report')
            }
        }
        const branches: GithubBranch[] = await this.reportsService.getBranches(reportId)
        return new NormalizedResponseDTO(branches)
    }

    // todo: this function name is confusing?
    @Get('/:reportId/tree')
    @ApiOperation({
        summary: `Explore a report tree`,
        description: `Get hash of a file for a given report. If the file is a folder, will get information about the files in it too (non-recursively). Path is currently ignored for local reports.`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Content of the requested file`,
        type: String,
    })
    @ApiParam({
        name: 'reportId',
        required: true,
        description: 'Id of the report to fetch',
        schema: { type: 'string' },
    })
    async getReportTree(
        @Headers(HEADER_X_KYSO_ORGANIZATION) organizationName: string,
        @Headers(HEADER_X_KYSO_TEAM) teamName: string,
        @CurrentToken() token: Token,
        @Param('reportId') reportId: string,
        @Query('path') path: string,
        @Query('version') versionStr: string,
    ): Promise<NormalizedResponseDTO<GithubFileHash | GithubFileHash[]>> {
        const report: Report = await this.reportsService.getReportById(reportId)
        if (!report) {
            throw new PreconditionFailedException('Report not found')
        }
        const team: Team = await this.teamsService.getTeamById(report.team_id)
        if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
            const hasPermissions: boolean = await AuthService.hasPermissions(token, [ReportPermissionsEnum.READ], teamName, organizationName)
            if (!hasPermissions) {
                throw new ForbiddenException('You do not have permissions to access this report')
            }
        }
        let version: number | null
        if (versionStr && !isNaN(Number(versionStr))) {
            version = parseInt(versionStr, 10)
        }
        const hash: GithubFileHash | GithubFileHash[] = await this.reportsService.getReportTree(reportId, path, version)
        return new NormalizedResponseDTO(hash)
    }

    @Get('/file/:id')
    @Public()
    @ApiOperation({
        summary: `Get content of a file`,
        description: `By passing the id a file, get its raw content directly from the source.`,
    })
    @ApiParam({
        name: 'id',
        required: true,
        description: 'Id of the report to fetch',
        schema: { type: 'string' },
    })
    async getReportFileContent(
        @Headers(HEADER_X_KYSO_ORGANIZATION) organizationName: string,
        @Headers(HEADER_X_KYSO_TEAM) teamName: string,
        @CurrentToken() token: Token,
        @Param('id') id: string,
    ): Promise<Buffer> {
        const file: File = await this.reportsService.getFileById(id)
        if (!file) {
            throw new PreconditionFailedException('File not found')
        }
        const report: Report = await this.reportsService.getReportById(file.report_id)
        if (!report) {
            throw new PreconditionFailedException('Report not found')
        }
        const team: Team = await this.teamsService.getTeamById(report.team_id)
        if (!token) {
            if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
                throw new PreconditionFailedException(`Report is not public`)
            }
        } else {
            const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id)
            const index: number = teams.findIndex((t: Team) => t.id === team.id)
            if (index === -1) {
                throw new ForbiddenException('You do not have permissions to access this report')
            }
            // const hasPermissions: boolean = await AuthService.hasPermissions(token, [ReportPermissionsEnum.READ], teamName, organizationName)
            // if (!hasPermissions) {
            //     throw new ForbiddenException('You do not have permissions to access this report')
            // }
        }
        return this.reportsService.getReportFileContent(file)
    }

    @UseInterceptors(
        FileInterceptor('file', {
            fileFilter: (req, file, callback) => {
                if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
                    return callback(new Error('Only image files are allowed!'), false)
                }
                callback(null, true)
            },
        }),
    )
    @Post('/:reportId/preview-picture')
    @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Upload a profile picture for a report`,
        description: `Allows uploading a profile picture for a report passing its id and image`,
    })
    @ApiParam({
        name: 'reportId',
        required: true,
        description: `Id of the report to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 201, description: `Updated report`, type: ReportDTO })
    @Permission([ReportPermissionsEnum.EDIT])
    public async setProfilePicture(
        @CurrentToken() token: Token,
        @Param('reportId') reportId: string,
        @UploadedFile() file: any,
    ): Promise<NormalizedResponseDTO<ReportDTO>> {
        if (!file) {
            throw new BadRequestException(`Missing file`)
        }
        const report: Report = await this.reportsService.setPreviewPicture(reportId, file)
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id)
        const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' })
        return new NormalizedResponseDTO(reportDto, relations)
    }

    @Delete('/:reportId/preview-picture')
    @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Delete a profile picture for a report`,
        description: `Allows deleting a profile picture for a report passing its id`,
    })
    @ApiParam({
        name: 'reportId',
        required: true,
        description: `Id of the report to fetch`,
        schema: { type: 'string' },
    })
    @Permission([ReportPermissionsEnum.EDIT])
    @ApiNormalizedResponse({ status: 200, description: `Updated report`, type: ReportDTO })
    public async deleteBackgroundImage(@CurrentToken() token: Token, @Param('reportId') reportId: string): Promise<NormalizedResponseDTO<ReportDTO>> {
        const report: Report = await this.reportsService.deletePreviewPicture(reportId)
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id)
        const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' })
        return new NormalizedResponseDTO(reportDto, relations)
    }

    @Get('/:reportName/:teamName')
    @ApiOperation({
        summary: `Get a report`,
        description: `Allows fetching content of a specific report passing its name and team name`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Report matching name and team name`,
        type: ReportDTO,
    })
    @ApiParam({
        name: 'reportName',
        required: true,
        description: 'Name of the report to fetch',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'teamName',
        required: true,
        description: 'Name of the team to fetch',
        schema: { type: 'string' },
    })
    async getReportByName(
        @Headers(HEADER_X_KYSO_ORGANIZATION) organizationName: string,
        @Headers(HEADER_X_KYSO_TEAM) teamName: string,
        @CurrentToken() token: Token,
        @Param('reportName') reportName: string,
        @Param('teamName') teamNameParam: string,
    ): Promise<NormalizedResponseDTO<ReportDTO>> {
        const report: Report = await this.reportsService.getReportByName(reportName, teamNameParam)
        const team: Team = await this.teamsService.getTeamById(report.team_id)
        if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
            const hasPermissions: boolean = await AuthService.hasPermissions(token, [ReportPermissionsEnum.READ], teamName, organizationName)
            if (!hasPermissions) {
                throw new ForbiddenException('You do not have permissions to access this report')
            }
        }
        const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' })
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id)
        return new NormalizedResponseDTO(reportDto, relations)
    }
}
