import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GenericController } from 'src/generic/controller.generic';
import { HateoasLinker } from 'src/helpers/hateoasLinker';
import { Report } from 'src/model/report.model';
import { QueryParser } from 'src/helpers/queryParser';
import { Validators } from 'src/helpers/validators';
import { InvalidInputError } from 'src/helpers/errorHandling';
import { CommentsService } from 'src/modules/comments/comments.service';
import { ReportsService } from './reports.service';

const UPDATABLE_FIELDS = [
    "stars",
    "tags",
    "title",
    "description",
    "request_private",
    "name",
]

const DEFAULT_GET_REPORT_FILTERS = {
    state: { $ne: "DELETED" },
    hidden: { $ne: "true" },
    pin: { $ne: "true" }
}

@ApiTags('reports')
@Controller('reports')
export class ReportsController extends GenericController<Report> {
    constructor(
        private readonly reportsService: ReportsService,
        private readonly commentsService: CommentsService) {
        super();
    }

    // assigned to null because does not match between documentation and real code...
    assignReferences(report: any/*report: Report*/) {
    
        report.self_url = HateoasLinker.createRef(`/reports/${report.full_name}`)
        report.branches_url = HateoasLinker.createRef(`/reports/${report.full_name}/branches`)
    
        report.owner.selfUrl = HateoasLinker.createRef(`/${report.owner.type}s/${report.owner.name || report.owner.nickname}`)
    
        if (report.source) {
            if (report.source.provider !== "s3") {
                report.tree_url = HateoasLinker.createRef(`/reports/${report.full_name}/${report.source.defaultBranch}/tree`)
                report.commits_url = HateoasLinker.createRef(`/reports/${report.full_name}/${report.source.defaultBranch}/commits`)
                
                // TODO: Does that should be a HateoasLinker as well?
                report.html_url = `https://${report.source.provider}.com/${report.source.owner}/${report.source.name}`
            }
        }
    }

    async getReports(req, res) {
        const query = QueryParser.toQueryObject(req.url)
        if (!query.sort) query.sort = { _created_at: -1 }
        if (!query.filter) query.filter = {}
        Object.entries(DEFAULT_GET_REPORT_FILTERS).forEach(([key, value]) => { if (!query.filter[key]) query.filter[key] = value })
    
        const reports = await this.reportsService.getReports(query)
    
        reports.forEach( x => this.assignReferences(x))
        return res.status(200).send(reports)
      }
    
      async getReport(req, res) {
        const report = await this.reportsService.getReport(req.params.reportOwner, req.params.reportName)
    
        this.assignReferences(report)
        return res.status(200).send(report)
      }
    
      async createReport(req, res) {
        const owner = req.body.team || req.user.nickname
        if (Array.isArray(req.body.reports)) {
          const promises = req.body.reports.map(report => this.reportsService.createReport(req.user, report, req.body.team))
          const results = await Promise.allSettled(promises) as any
    
          const response = []
          results.forEach(result => {
            if (result.status === "fulfilled") {
              response.push({
                status: "OK",
                selfUrl: HateoasLinker.createRef(`/reports/${owner}/${result.value.name}`)
              })
            } else {
              response.push({
                status: "ERROR",
                reason: result.reason.message
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
    
      async updateReport(req, res) {
        const fields = Object.fromEntries(Object.entries(req.body).filter(entry => UPDATABLE_FIELDS.includes(entry[0])))
    
        const { stars, ...rest } = fields
        const updatePayload = { $set: rest, $inc: { stars: Math.sign(stars as any) } }
    
        const report = await (Object.keys(fields).length === 0 ? this.reportsService.getReport(req.params.reportOwner, req.params.reportName)
          : await this.reportsService.updateReport(req.user.objectId, req.params.reportOwner, req.params.reportName, updatePayload))
    
        return res.status(200).send(report)
      }
    
      async deleteReport(req, res) {
        await this.reportsService.deleteReport(req.user.objectId, req.params.reportOwner, req.params.reportName);
    
        return res.status(204).send()
      }
    
      async pinReport(req, res) {
        const report = await this.reportsService.pinReport(req.user.objectId, req.params.reportOwner, req.params.reportName);
    
        return res.status(200).send(report)
      }
    
      async getComments(req, res) {
        const { id: reportId } = await this.reportsService.getReport(req.params.reportOwner, req.params.reportName)
    
        const comments = await this.commentsService.getReportComments(reportId)
    
        const assignRefs = (comment) => {
          comment.selfUrl = HateoasLinker.createRef(`/comments/${comment.id}`)
          comment.childComments.forEach(assignRefs)
        }
        comments.forEach(comment => { assignRefs(comment) })
    
        return res.status(200).send(comments)
      }
    
      async getBranches(req, res) {
        const { reportOwner, reportName } = req.params
        const branches = await this.reportsService.getBranches(reportOwner, reportName)
    
        branches.forEach(branch => {
          branch.contentUrl = HateoasLinker.createRef(`/reports/${reportOwner}/${reportName}/${branch.name}/tree`)
          branch.commitsUrl = HateoasLinker.createRef(`/reports/${reportOwner}/${reportName}/${branch.name}/commits`)
        })
    
        return res.status(200).send(branches)
      }
    
      async getCommits(req, res) {
        const { reportOwner, reportName } = req.params
        const branch = req.params[0]
        const commits = await this.reportsService.getCommits(reportOwner, reportName, branch)
    
        commits.forEach(commit => {
          commit.selfUrl = HateoasLinker.createRef(`/reports/${reportOwner}/${reportName}/${commit.sha}/tree`)
        })
    
        return res.status(200).send(commits)
      }
    
      async getReportFileHash(req, res) {
        const { reportOwner, reportName } = req.params
        const branch = req.params[0]
        const hash = await this.reportsService.getFileHash(reportOwner, reportName, branch, req.params[1])
    
        const assignUrl = (item) => {
          const route = (item.type === "dir") ? `${branch}/tree/${item.path}` : `file/${item.hash}`
          item.selfUrl = HateoasLinker.createRef(`/reports/${reportOwner}/${reportName}/${route}`)
        }
        if (Array.isArray(hash)) hash.forEach(assignUrl)
        else assignUrl(hash)
    
        return res.status(200).send(hash)
      }
    
      async getReportFileContent(req, res) {
        const { hash } = req.params
        if (!Validators.isValidSha(hash)) throw new InvalidInputError({ message: "Hash is not a valid sha. Must have 40 hexadecimal characters." })
    
        const content = await this.reportsService.getReportFileContent(req.params.reportOwner, req.params.reportName, hash)
    
        return res.status(200).send(content)
      }
}
