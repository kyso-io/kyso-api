import {
    BatchReportCreationDTO,
    Comment,
    CreateReportDTO,
    CreateReportRequestDTO,
    GithubBranch,
    GithubCommit,
    GithubFileHash,
    NormalizedResponseDTO,
    Report,
    ReportDTO,
    Token,
    UpdateReportRequestDTO,
    User,
} from '@kyso-io/kyso-model'
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiOperation, ApiParam, ApiResponse, ApiTags, getSchemaPath } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Autowired } from '../../decorators/autowired'
import { GenericController } from '../../generic/controller.generic'
import { InvalidInputError } from '../../helpers/errorHandling'
import { QueryParser } from '../../helpers/queryParser'
import { Validators } from '../../helpers/validators'
import { CurrentToken } from '../auth/annotations/current-token.decorator'
import { Permission } from '../auth/annotations/permission.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { CommentsService } from '../comments/comments.service'
import { RelationsService } from '../relations/relations.service'
import { UsersService } from '../users/users.service'
import { ReportsService } from './reports.service'
import { ReportPermissionsEnum } from './security/report-permissions.enum'

const UPDATABLE_FIELDS = ['stars', 'tags', 'title', 'description', 'request_private', 'name']

const DEFAULT_GET_REPORT_FILTERS = {
    state: { $ne: 'DELETED' },
    hidden: { $ne: 'true' },
}

@ApiExtraModels(Report, NormalizedResponseDTO)
@ApiTags('reports')
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('reports')
export class ReportsController extends GenericController<Report> {
    @Autowired({ typeName: 'CommentsService' })
    private commentsService: CommentsService

    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    @Autowired({ typeName: 'ReportsService' })
    private reportsService: ReportsService

    @Autowired({ typeName: 'RelationsService' })
    private relationsService: RelationsService

    constructor() {
        super()
    }

    @Get()
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
    @Permission([ReportPermissionsEnum.READ])
    async getReports(@CurrentToken() token: Token, @Req() req): Promise<NormalizedResponseDTO<ReportDTO[]>> {
        // Object paginationQuery is there for documentation purposes. A refactor of this method should be done in the future
        const query = QueryParser.toQueryObject(req.url)
        if (!query.sort) query.sort = { _created_at: -1 }
        if (!query.filter) query.filter = {}
        Object.entries(DEFAULT_GET_REPORT_FILTERS).forEach(([key, value]) => {
            if (!query.filter[key]) query.filter[key] = value
        })
        const reportDtos: ReportDTO[] = await this.reportsService.getReportDtos(token.id, query)
        const relations = await this.relationsService.getRelations(reportDtos, 'report')
        return new NormalizedResponseDTO(reportDtos, relations)
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
    @Permission([ReportPermissionsEnum.READ])
    async getReport(@CurrentToken() token: Token, @Param('reportId') reportId: string): Promise<NormalizedResponseDTO<ReportDTO>> {
        const report: Report = await this.reportsService.getReportById(reportId)
        if (!report) {
            throw new InvalidInputError('Report not found')
        }
        const relations = await this.relationsService.getRelations(report, 'report')
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id)
        return new NormalizedResponseDTO(reportDto, relations)
    }

    @Get('/user/:userId/pinned')
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
    async getPinnedReportsForUser(@Param('userId') userId: string): Promise<NormalizedResponseDTO<ReportDTO[]>> {
        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new InvalidInputError('User not found')
        }
        const reportDtos: ReportDTO[] = await this.reportsService.getPinnedReportsForUser(user.id)
        const relations = await this.relationsService.getRelations(reportDtos, 'report')
        return new NormalizedResponseDTO(reportDtos, relations)
    }

    @Post()
    @ApiOperation({
        summary: `Create a new report`,
        description: `By passing the appropiate parameters you can create a new report referencing a git repository`,
    })
    @ApiResponse({
        status: 201,
        description: `Created report object if passed a single Report, or an array of report creation status if passed an array of reports to create (see schemas)`,
        schema: {
            oneOf: [{ $ref: getSchemaPath(Report) }, { $ref: getSchemaPath(BatchReportCreationDTO) }],
        },
    })
    @ApiBody({
        type: CreateReportRequestDTO,
        description: 'Pass an array to create multiple objects',
    })
    @Permission([ReportPermissionsEnum.CREATE])
    async createReport(@CurrentToken() token: Token, @Body() createReportDto: CreateReportDTO): Promise<NormalizedResponseDTO<Report>> {
        const report = await this.reportsService.createReport(token.id, createReportDto)
        const relations = await this.relationsService.getRelations(report, 'report')
        return new NormalizedResponseDTO(report, relations)
    }

    @Patch('/:reportId')
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
    async updateReport(@CurrentToken() token: Token, @Param('reportId') reportId: string, @Body() body: any): Promise<NormalizedResponseDTO<ReportDTO>> {
        const fields = Object.fromEntries(Object.entries(body).filter((entry) => UPDATABLE_FIELDS.includes(entry[0])))

        const { stars, ...rest } = fields
        const updatePayload = {
            $set: rest,
            $inc: { stars: Math.sign(stars as any) },
        }

        const report: Report =
            Object.keys(fields).length === 0
                ? await this.reportsService.getReportById(reportId)
                : await this.reportsService.updateReport(reportId, updatePayload)

        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id)
        const relations = await this.relationsService.getRelations(reportDto, 'report')
        return new NormalizedResponseDTO(report, relations)
    }

    @Delete('/:reportId')
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
    @ApiOperation({
        summary: `Toggles the pin of the specified report`,
        description: `Allows pinning of the specified report, unpins any other pinned report for owner`,
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
    @Permission([ReportPermissionsEnum.EDIT])
    async pinReport(@CurrentToken() token: Token, @Param('reportId') reportId: string): Promise<NormalizedResponseDTO<Report>> {
        const report: Report = await this.reportsService.pinReport(token.id, reportId)
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id)
        const relations = await this.relationsService.getRelations(reportDto, 'report')
        return new NormalizedResponseDTO(report, relations)
    }

    @Patch('/:reportId/user-pin')
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
    @Permission([ReportPermissionsEnum.EDIT])
    async toggleUserPin(@CurrentToken() token: Token, @Param('reportId') reportId: string): Promise<NormalizedResponseDTO<Report>> {
        const report: Report = await this.reportsService.toggleUserPin(token.id, reportId)
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id)
        const relations = await this.relationsService.getRelations(reportDto, 'report')
        return new NormalizedResponseDTO(report, relations)
    }

    @Patch('/:reportId/user-star')
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
    @Permission([ReportPermissionsEnum.EDIT])
    async toggleUserStar(@CurrentToken() token: Token, @Param('reportId') reportId: string): Promise<NormalizedResponseDTO<Report>> {
        const report: Report = await this.reportsService.toggleUserStar(token.id, reportId)
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id)
        const relations = await this.relationsService.getRelations(reportDto, 'report')
        return new NormalizedResponseDTO(report, relations)
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
    @Permission([ReportPermissionsEnum.READ])
    async getComments(@Param('reportId') reportId: string): Promise<NormalizedResponseDTO<Comment[]>> {
        const report: Report = await this.reportsService.getReportById(reportId)
        if (!report) {
            throw new InvalidInputError('Report not found')
        }
        const comments: Comment[] = await this.commentsService.getComments({ report_id: reportId })
        const relations = await this.relationsService.getRelations(comments, 'comment')
        return new NormalizedResponseDTO(
            comments.filter((comment: Comment) => !comment.comment_id),
            relations,
        )
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
    @Permission([ReportPermissionsEnum.READ])
    async getBranches(@CurrentToken() token: Token, @Param('reportId') reportId: string): Promise<NormalizedResponseDTO<GithubBranch[]>> {
        const branches: GithubBranch[] = await this.reportsService.getBranches(token.id, reportId)
        return new NormalizedResponseDTO(branches)
    }

    @Get('/:reportId/:branch/commits')
    @ApiOperation({
        summary: `Get commits of a report imported from a git provider`,
        description: `By passing in the appropriate options you can see the commits of a branch for the repository the specified report is linked to`,
    })
    @ApiParam({
        name: 'reportId',
        required: true,
        description: 'Id of the report to fetch',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'branch',
        required: true,
        description: 'GithubBranch to start listing commits from. Accepts slashes',
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Branches of the specified report`,
        type: GithubCommit,
        isArray: true,
    })
    @Permission([ReportPermissionsEnum.READ])
    async getCommits(
        @CurrentToken() token: Token,
        @Param('reportId') reportId: string,
        @Param('branch') branch: string,
    ): Promise<NormalizedResponseDTO<GithubCommit[]>> {
        const commits: any[] = await this.reportsService.getCommits(token.id, reportId, branch)
        return new NormalizedResponseDTO(commits)
    }

    // todo: this function name is confusing?
    @Get('/:reportId/:branch/tree/:filePath')
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
    @ApiParam({
        name: 'branch',
        required: true,
        description: 'GithubBranch of the repository to fetch data from. Accepts slashes.',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'filePath',
        required: true,
        description: 'Path of the file to be consulted',
        schema: { type: 'string' },
    })
    @Permission([ReportPermissionsEnum.READ])
    async getReportFileHash(
        @CurrentToken() token: Token,
        @Param('reportId') reportId: string,
        @Param('branch') branch: string,
        @Param('filePath') filePath: string,
    ): Promise<NormalizedResponseDTO<GithubFileHash | GithubFileHash[]>> {
        const hash: GithubFileHash | GithubFileHash[] = await this.reportsService.getFileHash(token.id, reportId, branch, filePath)
        return new NormalizedResponseDTO(hash)
    }

    @Get('/:reportId/file/:hash')
    @ApiOperation({
        summary: `Get content of a file`,
        description: `By passing the hash of a file, get its raw content directly from the source.`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Content of the requested file`,
        type: String,
    })
    @ApiParam({
        name: 'reportId',
        required: true,
        description: 'Name of the report to fetch',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'hash',
        required: true,
        description: 'Hash of the file to access',
        schema: { type: 'string' },
    })
    @Permission([ReportPermissionsEnum.READ])
    async getReportFileContent(
        @CurrentToken() token: Token,
        @Param('reportId') reportId: string,
        @Param('hash') hash: string,
    ): Promise<NormalizedResponseDTO<Buffer>> {
        if (!Validators.isValidSha(hash)) {
            throw new InvalidInputError({
                message: 'Hash is not a valid sha. Must have 40 hexadecimal characters.',
            })
        }
        const content: Buffer = await this.reportsService.getReportFileContent(token.id, reportId, hash)
        return new NormalizedResponseDTO(content)
    }
}
