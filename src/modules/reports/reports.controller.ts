import { Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags, getSchemaPath } from '@nestjs/swagger'
import { GenericController } from 'src/generic/controller.generic'
import { HateoasLinker } from 'src/helpers/hateoasLinker'
import { Report } from 'src/model/report.model'
import { QueryParser } from 'src/helpers/queryParser'
import { Validators } from 'src/helpers/validators'
import { InvalidInputError } from 'src/helpers/errorHandling'
import { CommentsService } from 'src/modules/comments/comments.service'
import { ReportsService } from './reports.service'
import { BatchReportCreation } from '../../model/dto/batch-report-creation-response.dto'
import { Comment } from 'src/model/comment.model'
import { Branch } from 'src/model/branch.model'
import { UsersService } from '../users/users.service'
import { User } from 'src/model/user.model'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { Permission } from '../auth/annotations/permission.decorator'
import { ReportPermissionsEnum } from './security/report-permissions.enum'
import { CreateReportRequest } from 'src/model/dto/create-report-request.dto'
import { ReportFilterQuery } from 'src/model/dto/report-filter-query.dto'
import { UpdateReportRequest } from 'src/model/dto/update-report-request.dto'

const UPDATABLE_FIELDS = ['stars', 'tags', 'title', 'description', 'request_private', 'name']

const DEFAULT_GET_REPORT_FILTERS = {
    state: { $ne: 'DELETED' },
    hidden: { $ne: 'true' },
}

@ApiTags('reports')
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('reports')
export class ReportsController extends GenericController<Report> {
    constructor(
        private readonly reportsService: ReportsService,
        private readonly commentsService: CommentsService,
        private readonly usersService: UsersService,
    ) {
        super()
    }

    // assigned to null because does not match between documentation and real code...
    assignReferences(report: any /*report: Report*/) {
        report.self_url = HateoasLinker.createRef(`/reports/${report.full_name}`)
        report.branches_url = HateoasLinker.createRef(`/reports/${report.full_name}/branches`)

        report.owner.selfUrl = HateoasLinker.createRef(`/${report.owner.type}s/${report.owner.name || report.owner.nickname}`)

        if (report.source) {
            if (report.source.provider !== 's3') {
                report.tree_url = HateoasLinker.createRef(`/reports/${report.full_name}/${report.source.defaultBranch}/tree`)
                report.commits_url = HateoasLinker.createRef(`/reports/${report.full_name}/${report.source.defaultBranch}/commits`)

                // TODO: Does that should be a HateoasLinker as well?
                report.html_url = `https://${report.source.provider}.com/${report.source.owner}/${report.source.name}`
            }
        }
    }

    @Get('')
    @ApiOperation({
        summary: `Search and fetch reports`,
        description: `By passing the appropiate parameters you can fetch and filter the reports available to the authenticated user.<br />
         **This endpoint supports filtering**. Refer to the Report schema to see available options.`,
    })
    @ApiResponse({
        status: 200,
        description: `Reports matching criteria`,
        type: Report,
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

        const reports = await this.reportsService.getReports(query)

        reports.forEach((x) => this.assignReferences(x))
        return res.status(200).send(reports)
    }

    @Get('/:reportOwner/:reportName')
    @ApiOperation({
        summary: `Get a report`,
        description: `Allows fetching content of a specific report passing its full name`,
    })
    @ApiResponse({
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
    async getReport(@Req() req, @Res() res) {
        const report = await this.reportsService.getReport(req.params.reportOwner, req.params.reportName)

        this.assignReferences(report)
        return res.status(200).send(report)
    }

    @Get('/:reportOwner/pinned')
    @ApiOperation({
        summary: `Get pinned reports for an user`,
        description: `Allows fetching pinned reports of a specific user passing its full name`,
    })
    @ApiResponse({
        status: 200,
        description: `All the pinned reports of an user`,
        type: Report,
        isArray: true,
    })
    @ApiParam({
        name: 'reportOwner',
        required: true,
        description: 'Name of the owner of the report to fetch',
        schema: { type: 'string' },
    })
    @Permission([ReportPermissionsEnum.READ])
    async getPinnedReportsForAnUser(@Param('reportOwner') reportOwner: string) {
        const userData: User = await this.usersService.getUser({ username: reportOwner })

        const pinnedReports = await this.reportsService.getReports({ pin: true, _p_user: userData.id })

        const response = []
        pinnedReports.forEach((report) => {
            response.push(this.assignReferences(report))
        })

        return response
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

            return res.status(201).send(response)
        }

        const created = await this.reportsService.createReport(req.user, req.body.reports, req.body.team)
        const report = await this.reportsService.getReport(owner, created.name)
        this.assignReferences(report)

        return res.status(201).send(report)
    }

    @Patch('/:reportOwner/:reportName')
    @ApiOperation({
        summary: `Update the specific report`,
        description: `Allows updating content from the specified report`,
    })
    @ApiResponse({
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
            ? this.reportsService.getReport(req.params.reportOwner, req.params.reportName)
            : await this.reportsService.updateReport(req.user.objectId, req.params.reportOwner, req.params.reportName, updatePayload))

        return res.status(200).send(report)
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
        await this.reportsService.deleteReport(req.user.objectId, req.params.reportOwner, req.params.reportName)

        return res.status(204).send()
    }

    @Post('/:reportOwner/:reportName/pin')
    @ApiOperation({
        summary: `Toggles the pin of the specified report`,
        description: `Allows pinning of the specified report, unpins any other pinned report for owner`,
    })
    @ApiResponse({
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
        const report = await this.reportsService.pinReport(req.user.objectId, req.params.reportOwner, req.params.reportName)

        return res.status(200).send(report)
    }

    @Get('/:reportOwner/:reportName/comments')
    @ApiOperation({
        summary: `Get comments of a report`,
        description: `By passing in the appropriate options you can see all the comments of a report`,
    })
    @ApiResponse({
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
        const { id: reportId } = await this.reportsService.getReport(req.params.reportOwner, req.params.reportName)

        const comments = await this.commentsService.getReportComments(reportId)

        const assignRefs = (comment) => {
            comment.selfUrl = HateoasLinker.createRef(`/comments/${comment.id}`)
            comment.childComments.forEach(assignRefs)
        }
        comments.forEach((comment) => {
            assignRefs(comment)
        })

        return res.status(200).send(comments)
    }

    @Get('/:reportOwner/:reportName/branches')
    @ApiOperation({
        summary: `Get branches of a report`,
        description: `By passing in the appropriate options you can see all the branches of a report`,
    })
    @ApiResponse({
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
        const branches = await this.reportsService.getBranches(reportOwner, reportName)

        branches.forEach((branch) => {
            branch.contentUrl = HateoasLinker.createRef(`/reports/${reportOwner}/${reportName}/${branch.name}/tree`)
            branch.commitsUrl = HateoasLinker.createRef(`/reports/${reportOwner}/${reportName}/${branch.name}/commits`)
        })

        return res.status(200).send(branches)
    }

    @Get('/:reportOwner/:reportName/:branch/commits')
    @ApiOperation({
        summary: `Get commits of a report imported from a git provider`,
        description: `By passing in the appropriate options you can see the commits of a branch for the repository the specified report is linked to`,
    })
    @ApiResponse({
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
        const commits = await this.reportsService.getCommits(reportOwner, reportName, branch)

        commits.forEach((commit) => {
            commit.selfUrl = HateoasLinker.createRef(`/reports/${reportOwner}/${reportName}/${commit.sha}/tree`)
        })

        return res.status(200).send(commits)
    }

    // todo: this function name is confusing?
    @Get('/:reportOwner/:reportName/:branch/tree/:filePath')
    @ApiOperation({
        summary: `Explore a report tree`,
        description: `Get hash of a file for a given report. If the file is a folder, will get information about the files in it too (non-recursively). Path is currently ignored for local reports.`,
    })
    @ApiResponse({
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
        const hash = await this.reportsService.getFileHash(reportOwner, reportName, branch, req.params[1])

        const assignUrl = (item) => {
            const route = item.type === 'dir' ? `${branch}/tree/${item.path}` : `file/${item.hash}`
            item.selfUrl = HateoasLinker.createRef(`/reports/${reportOwner}/${reportName}/${route}`)
        }
        if (Array.isArray(hash)) hash.forEach(assignUrl)
        else assignUrl(hash)

        return res.status(200).send(hash)
    }

    @Get('/:reportOwner/:reportName/file/:hash')
    @ApiOperation({
        summary: `Get content of a file`,
        description: `By passing the hash of a file, get its raw content directly from the source.`,
    })
    @ApiResponse({
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

        const content = await this.reportsService.getReportFileContent(req.params.reportOwner, req.params.reportName, hash)

        return res.status(200).send(content)
    }
}
