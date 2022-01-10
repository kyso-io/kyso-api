import { Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiOperation, ApiParam, ApiResponse, ApiTags, getSchemaPath } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-repose'
import { GenericController } from '../../generic/controller.generic'
import { InvalidInputError } from '../../helpers/errorHandling'
import { HateoasLinker } from '../../helpers/hateoasLinker'
import { QueryParser } from '../../helpers/queryParser'
import { Validators } from '../../helpers/validators'
import { commentsService, relationsService, reportsService, usersService } from '../../main'
import { Branch } from '../../model/branch.model'
import { Comment } from '../../model/comment.model'
import { BatchReportCreation } from '../../model/dto/batch-report-creation-response.dto'
import { CreateReportRequest } from '../../model/dto/create-report-request.dto'
import { NormalizedResponse } from '../../model/dto/normalized-reponse.dto'
import { ReportFilterQuery } from '../../model/dto/report-filter-query.dto'
import { UpdateReportRequest } from '../../model/dto/update-report-request.dto'
import { Report } from '../../model/report.model'
import { User } from '../../model/user.model'
import { Permission } from '../auth/annotations/permission.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { ReportPermissionsEnum } from './security/report-permissions.enum'

const UPDATABLE_FIELDS = ['stars', 'tags', 'title', 'description', 'request_private', 'name']

const DEFAULT_GET_REPORT_FILTERS = {
    state: { $ne: 'DELETED' },
    hidden: { $ne: 'true' },
}

@ApiExtraModels(Report, NormalizedResponse)
@ApiTags('reports')
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('reports')
export class ReportsController extends GenericController<Report> {
    constructor() {
        super()
    }

    @Get('')
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
    async getReports(@Req() req, @Res() res, @Query() paginationQuery: ReportFilterQuery) {
        // Object paginationQuery is there for documentation purposes. A refactor of this method should be done in the future
        const query = QueryParser.toQueryObject(req.url)
        if (!query.sort) query.sort = { _created_at: -1 }
        if (!query.filter) query.filter = {}
        Object.entries(DEFAULT_GET_REPORT_FILTERS).forEach(([key, value]) => {
            if (!query.filter[key]) query.filter[key] = value
        })

        const reports = await reportsService.getReports(query)
        const relations = await relationsService.getRelations(reports)
        res.status(200).send(new NormalizedResponse(reports, relations))
        return
    }

    @Get('/:reportOwner/:reportName')
    @ApiOperation({
        summary: `Get a report`,
        description: `Allows fetching content of a specific report passing its full name`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Report matching id`,
        type: Report,
    })
    @ApiParam({
        name: 'reportOwner',
        required: true,
        description: 'Name of the owner of the report to fetch',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'reportName',
        required: true,
        description: 'Name of the report to fetch',
        schema: { type: 'string' },
    })
    @Permission([ReportPermissionsEnum.READ])
    async getReport(@Req() req, @Res() res): Promise<void> {
        const report = await reportsService.getReport(req.params.reportOwner, req.params.reportName)
        const relations = await relationsService.getRelations(report)
        res.status(200).send(new NormalizedResponse(report, relations))
        return
    }

    @Get('/:reportOwner/pinned')
    @ApiOperation({
        summary: `Get pinned reports for an user`,
        description: `Allows fetching pinned reports of a specific user passing its full name`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `All the pinned reports of an user`,
        type: Report,
    })
    @ApiParam({
        name: 'reportOwner',
        required: true,
        description: 'Name of the owner of the report to fetch',
        schema: { type: 'string' },
    })
    @Permission([ReportPermissionsEnum.READ])
    async getPinnedReportsForAnUser(@Param('reportOwner') reportOwner: string) {
        const userData: User = await usersService.getUser({ username: reportOwner })
        const reports = await reportsService.getReports({ pin: true, user_id: userData.id })
        const relations = await relationsService.getRelations(reports)
        return new NormalizedResponse(reports, relations)
    }

    @Post('')
    @ApiOperation({
        summary: `Create a new report`,
        description: `By passing the appropiate parameters you can create a new report referencing a git repository`,
    })
    @ApiResponse({
        status: 201,
        description: `Created report object if passed a single Report, or an array of report creation status if passed an array of reports to create (see schemas)`,
        schema: {
            oneOf: [{ $ref: getSchemaPath(Report) }, { $ref: getSchemaPath(BatchReportCreation) }],
        },
    })
    @ApiBody({
        type: CreateReportRequest,
        description: 'Pass an array to create multiple objects',
    })
    @Permission([ReportPermissionsEnum.CREATE])
    async createReport(@Req() req, @Req() res) {
        const owner = req.body.team || req.user.nickname
        if (Array.isArray(req.body.reports)) {
            const promises = req.body.reports.map((report) => reportsService.createReport(req.user, report, req.body.team))
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

        const created = await reportsService.createReport(req.user, req.body.reports, req.body.team)
        const report = await reportsService.getReport(owner, created.name)

        const relations = await relationsService.getRelations(report)
        res.status(201).send(new NormalizedResponse(report, relations))
        return
    }

    @Patch('/:reportOwner/:reportName')
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
        name: 'reportOwner',
        required: true,
        description: 'Name of the owner of the report to fetch',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'reportName',
        required: true,
        description: 'Name of the report to fetch',
        schema: { type: 'string' },
    })
    @ApiBody({ type: UpdateReportRequest })
    @Permission([ReportPermissionsEnum.EDIT])
    async updateReport(@Req() req, @Res() res) {
        const fields = Object.fromEntries(Object.entries(req.body).filter((entry) => UPDATABLE_FIELDS.includes(entry[0])))

        const { stars, ...rest } = fields
        const updatePayload = {
            $set: rest,
            $inc: { stars: Math.sign(stars as any) },
        }

        const report = await (Object.keys(fields).length === 0
            ? reportsService.getReport(req.params.reportOwner, req.params.reportName)
            : await reportsService.updateReport(req.user.objectId, req.params.reportOwner, req.params.reportName, updatePayload))

        const relations = await relationsService.getRelations(report)
        res.status(200).send(new NormalizedResponse(report, relations))
        return
    }

    @Delete('/:reportOwner/:reportName')
    @ApiOperation({
        summary: `Delete a report`,
        description: `Allows deleting a specific report`,
    })
    @ApiResponse({ status: 204, description: `Report deleted` })
    @ApiParam({
        name: 'reportOwner',
        required: true,
        description: 'Name of the owner of the report to fetch',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'reportName',
        required: true,
        description: 'Name of the report to fetch',
        schema: { type: 'string' },
    })
    @Permission([ReportPermissionsEnum.DELETE])
    async deleteReport(@Req() req, @Res() res) {
        await reportsService.deleteReport(req.user.objectId, req.params.reportOwner, req.params.reportName)
        res.status(204).send()
        return
    }

    @Post('/:reportOwner/:reportName/pin')
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
        name: 'reportOwner',
        required: true,
        description: 'Name of the owner of the report to fetch',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'reportName',
        required: true,
        description: 'Name of the report to fetch',
        schema: { type: 'string' },
    })
    @Permission([ReportPermissionsEnum.EDIT])
    async pinReport(@Req() req, @Res() res) {
        const report = await reportsService.pinReport(req.user.objectId, req.params.reportOwner, req.params.reportName)
        const relations = await relationsService.getRelations(report)
        res.status(200).send(new NormalizedResponse(report, relations))
        return
    }

    @Get('/:reportOwner/:reportName/comments')
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
        name: 'reportOwner',
        required: true,
        description: 'Name of the owner of the report to fetch',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'reportName',
        required: true,
        description: 'Name of the report to fetch',
        schema: { type: 'string' },
    })
    @Permission([ReportPermissionsEnum.READ])
    async getComments(@Req() req, @Res() res) {
        const { id: report_id } = await reportsService.getReport(req.params.reportOwner, req.params.reportName)

        const comments = await commentsService.getComments({ report_id })
        const relations = await relationsService.getRelations(comments)
        res.status(200).send(new NormalizedResponse(comments, relations))
        return
    }

    @Get('/:reportOwner/:reportName/branches')
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
        name: 'reportOwner',
        required: true,
        description: 'Name of the owner of the report to fetch',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'reportName',
        required: true,
        description: 'Name of the report to fetch',
        schema: { type: 'string' },
    })
    @Permission([ReportPermissionsEnum.READ])
    async getBranches(@Req() req, @Res() res) {
        const { reportOwner, reportName } = req.params
        const branches = await reportsService.getBranches(reportOwner, reportName)
        res.status(200).send(new NormalizedResponse(branches))
        return
    }

    @Get('/:reportOwner/:reportName/:branch/commits')
    @ApiOperation({
        summary: `Get commits of a report imported from a git provider`,
        description: `By passing in the appropriate options you can see the commits of a branch for the repository the specified report is linked to`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Commits of the specified report branch`,
        type: Branch,
        isArray: true,
    })
    @ApiParam({
        name: 'reportOwner',
        required: true,
        description: 'Name of the owner of the report to fetch',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'reportName',
        required: true,
        description: 'Name of the report to fetch',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'branch',
        required: true,
        description: 'Branch to start listing commits from. Accepts slashes',
        schema: { type: 'string' },
    })
    @Permission([ReportPermissionsEnum.READ])
    async getCommits(@Req() req, @Res() res) {
        const { reportOwner, reportName } = req.params
        const branch = req.params[0]
        const commits = await reportsService.getCommits(reportOwner, reportName, branch)
        res.status(200).send(new NormalizedResponse(commits))
        return
    }

    // todo: this function name is confusing?
    @Get('/:reportOwner/:reportName/:branch/tree/:filePath')
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
        name: 'reportOwner',
        required: true,
        description: 'Name of the owner of the report to fetch',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'reportName',
        required: true,
        description: 'Name of the report to fetch',
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
    async getReportFileHash(@Req() req, @Res() res) {
        const { reportOwner, reportName } = req.params
        const branch = req.params[0]
        const hash = await reportsService.getFileHash(reportOwner, reportName, branch, req.params[1])
        res.status(200).send(new NormalizedResponse(hash))
        return
    }

    @Get('/:reportOwner/:reportName/file/:hash')
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
        name: 'reportOwner',
        required: true,
        description: 'Name of the owner of the report to fetch',
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'reportName',
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
    async getReportFileContent(@Res() req, @Req() res) {
        const { hash } = req.params
        if (!Validators.isValidSha(hash))
            throw new InvalidInputError({
                message: 'Hash is not a valid sha. Must have 40 hexadecimal characters.',
            })

        const content = await reportsService.getReportFileContent(req.params.reportOwner, req.params.reportName, hash)

        res.status(200).send(content)
        return
    }
}
