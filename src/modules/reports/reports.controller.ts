import {
    BatchReportCreationDTO,
    Branch,
    Comment,
    CreateReportRequestDTO,
    NormalizedResponseDTO,
    Report,
    ReportFilterQueryDTO,
    Token,
    UpdateReportRequestDTO,
    User,
} from '@kyso-io/kyso-model'
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiOperation, ApiParam, ApiResponse, ApiTags, getSchemaPath } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Autowired } from '../../decorators/autowired'
import { GenericController } from '../../generic/controller.generic'
import { InvalidInputError } from '../../helpers/errorHandling'
import { HateoasLinker } from '../../helpers/hateoasLinker'
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
        type: Report,
        isArray: true,
    })
    @Permission([ReportPermissionsEnum.READ])
    async getReports(@Req() req, @Query() paginationQuery: ReportFilterQueryDTO): Promise<NormalizedResponseDTO<Report[]>> {
        // Object paginationQuery is there for documentation purposes. A refactor of this method should be done in the future
        const query = QueryParser.toQueryObject(req.url)
        if (!query.sort) query.sort = { _created_at: -1 }
        if (!query.filter) query.filter = {}
        Object.entries(DEFAULT_GET_REPORT_FILTERS).forEach(([key, value]) => {
            if (!query.filter[key]) query.filter[key] = value
        })
        const reports: Report[] = await this.reportsService.getReports(query)
        const relations = await this.relationsService.getRelations(reports, 'report')
        return new NormalizedResponseDTO(reports, relations)
    }

    @Get('/:reportId')
    @ApiOperation({
        summary: `Get a report`,
        description: `Allows fetching content of a specific report passing its id`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Report matching id`,
        type: Report,
    })
    @ApiParam({
        name: 'reportId',
        required: true,
        description: 'Id of the report to fetch',
        schema: { type: 'string' },
    })
    @Permission([ReportPermissionsEnum.READ])
    async getReport(@Param('reportId') reportId: string): Promise<NormalizedResponseDTO<Report>> {
        const report: Report = await this.reportsService.getReportById(reportId)
        if (!report) {
            throw new InvalidInputError('Report not found')
        }
        const relations = await this.relationsService.getRelations(report, 'report')
        return new NormalizedResponseDTO(report, relations)
    }

    @Get('/:userId/pinned')
    @ApiOperation({
        summary: `Get pinned reports for an user`,
        description: `Allows fetching pinned reports of a specific user passing its id`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `All the pinned reports of an user`,
        type: Report,
    })
    @ApiParam({
        name: 'userId',
        required: true,
        description: 'Id of the owner of the report to fetch',
        schema: { type: 'string' },
    })
    @Permission([ReportPermissionsEnum.READ])
    async getPinnedReportsForAnUser(@Param('userId') userId: string): Promise<NormalizedResponseDTO<Report[]>> {
        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new InvalidInputError('User not found')
        }
        const reports: Report[] = await this.reportsService.getReports({ pin: true, user_id: user.id })
        const relations = await this.relationsService.getRelations(reports, 'report')
        return new NormalizedResponseDTO(reports, relations)
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
    async createReport(@Req() req, @Req() res) {
        const owner = req.body.team || req.user.nickname
        if (Array.isArray(req.body.reports)) {
            const promises = req.body.reports.map((report) => this.reportsService.createReport(req.user, report, req.body.team))
            const results = (await Promise.allSettled(promises)) as any

            const response = []
            results.forEach((result) => {
                if (result.status === 'fulfilled') {
                    response.push({
                        status: 'OK',
                        selfUrl: HateoasLinker.createRef(`/reports/${owner}/${result.value.name}`),
                    })
                } else {
                    response.push({
                        status: 'ERROR',
                        reason: result.reason.message,
                    })
                }
            })

            res.status(201).send(response)
            return
        }

        const created = await this.reportsService.createReport(req.user, req.body.reports, req.body.team)
        const report = await this.reportsService.getReport(owner, created.name)

        const relations = await this.relationsService.getRelations(report, 'report')
        res.status(201).send(new NormalizedResponseDTO(report, relations))
        return
    }

    @Patch('/:reportId')
    @ApiOperation({
        summary: `Update the specific report`,
        description: `Allows updating content from the specified report`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Specified report data`,
        type: Report,
    })
    @ApiParam({
        name: 'reportId',
        required: true,
        description: 'Id of the report to update',
        schema: { type: 'string' },
    })
    @ApiBody({ type: UpdateReportRequestDTO })
    @Permission([ReportPermissionsEnum.EDIT])
    async updateReport(@Param('reportId') reportId: string, @Body() body: any): Promise<NormalizedResponseDTO<Report>> {
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

        const relations = await this.relationsService.getRelations(report, 'report')
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
        const report: Report = await this.reportsService.getReportById(reportId)
        if (!report) {
            throw new InvalidInputError('Report not found')
        }
        await this.reportsService.deleteReport(reportId)
        return new NormalizedResponseDTO(report)
    }

    @Post('/:reportId/pin')
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
        const relations = await this.relationsService.getRelations(report, 'report')
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
        type: Branch,
        isArray: true,
    })
    @ApiParam({
        name: 'reportId',
        required: true,
        description: 'Id of the report to fetch',
        schema: { type: 'string' },
    })
    @Permission([ReportPermissionsEnum.READ])
    async getBranches(@CurrentToken() token: Token, @Param('reportId') reportId: string): Promise<NormalizedResponseDTO<any[]>> {
        const branches: any[] = await this.reportsService.getBranches(token.id, reportId)
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
        description: 'Branch to start listing commits from. Accepts slashes',
        schema: { type: 'string' },
    })
    @Permission([ReportPermissionsEnum.READ])
    async getCommits(
        @CurrentToken() token: Token,
        @Param('reportId') reportId: string,
        @Param('branch') branch: string,
    ): Promise<NormalizedResponseDTO<any[]>> {
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
        description: 'Branch of the repository to fetch data from. Accepts slashes.',
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
    ): Promise<NormalizedResponseDTO<any>> {
        const hash: any = await this.reportsService.getFileHash(token.id, reportId, branch, filePath)
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
    ): Promise<NormalizedResponseDTO<any>> {
        if (!Validators.isValidSha(hash)) {
            throw new InvalidInputError({
                message: 'Hash is not a valid sha. Must have 40 hexadecimal characters.',
            })
        }
        const content = await this.reportsService.getReportFileContent(token.id, reportId, hash)
        return new NormalizedResponseDTO(content)
    }
}
