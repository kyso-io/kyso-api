import { Comment, GlobalPermissionsEnum, Report, Team, Token, Discussion } from '@kyso-io/kyso-model'
import { Injectable, PreconditionFailedException, Provider } from '@nestjs/common'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { userHasPermission } from '../../helpers/permissions'
import { ReportsService } from '../reports/reports.service'
import { DiscussionsService } from '../discussions/discussions.service'
import { TeamsService } from '../teams/teams.service'
import { CommentsMongoProvider } from './providers/mongo-comments.provider'
import { CommentPermissionsEnum } from './security/comment-permissions.enum'

function factory(service: CommentsService) {
    return service
}

export function createProvider(): Provider<CommentsService> {
    return {
        provide: `${CommentsService.name}`,
        useFactory: (service) => factory(service),
        inject: [CommentsService],
    }
}

@Injectable()
export class CommentsService extends AutowiredService {
    @Autowired({ typeName: 'TeamsService' })
    private teamsService: TeamsService

    @Autowired({ typeName: 'ReportsService' })
    private reportsService: ReportsService

    @Autowired({ typeName: 'DiscussionsService' })
    private discussionsService: DiscussionsService

    constructor(private readonly provider: CommentsMongoProvider) {
        super()
    }

    async createCommentGivenToken(token: Token, comment: Comment): Promise<Comment> {
        comment.user_id = token.id
        // comment.username = token.username
        if (comment?.comment_id) {
            const relatedComments: Comment[] = await this.provider.read({ filter: { _id: this.provider.toObjectId(comment.comment_id) } })
            if (relatedComments.length === 0) {
                throw new PreconditionFailedException('The specified related comment could not be found')
            }
        }

        const report: Report = await this.reportsService.getReportById(comment.report_id)
        const discussion: Discussion = await this.discussionsService.getDiscussion({
            filter: { id: comment.discussion_id, mark_delete_at: { $eq: null } },
        })

        if (!report && !discussion) {
            throw new PreconditionFailedException('The specified report or discussion could not be found')
        }

        if (!discussion && (!report.team_id || report.team_id == null || report.team_id === '')) {
            throw new PreconditionFailedException('The specified report does not have a team associated')
        }

        if (!report && (!discussion.team_id || discussion.team_id == null || discussion.team_id === '')) {
            throw new PreconditionFailedException('The specified discussion does not have a team associated')
        }

        const team: Team = await this.teamsService.getTeam({
            filter: {
                _id: this.provider.toObjectId(report ? report.team_id : discussion.team_id),
            },
        })

        if (!team) {
            throw new PreconditionFailedException('The specified team could not be found')
        }
        // THis is checked in the guard
        /*const userTeams: Team[] = await this.teamsService.getTeamsVisibleForUser(comment.user_id)
        
        /*const hasGlobalPermissionAdmin: boolean = userHasPermission(token, GlobalPermissionsEnum.GLOBAL_ADMIN)
        const userBelongsToTheTeam: boolean = userTeams.find((t: Team) => t.id === team.id) !== undefined
        

        /*if (!hasGlobalPermissionAdmin && !userBelongsToTheTeam) {
            throw new PreconditionFailedException('The specified user does not belong to the team of the specified report')
        }*/

        return this.createComment(comment)
    }

    async createComment(comment: Comment): Promise<Comment> {
        return this.provider.create(comment)
    }

    public async updateComment(token: Token, id: string, updateCommentRequest: Comment): Promise<Comment> {
        const comment: Comment = await this.getCommentById(id)
        if (!comment) {
            throw new PreconditionFailedException('The specified comment could not be found')
        }
        const dataFields: any = {
            text: updateCommentRequest.text,
            marked: updateCommentRequest.marked,
        }
        if (updateCommentRequest.marked) {
            dataFields.marked_by = token.id
        }
        if (comment.text !== updateCommentRequest.text) {
            dataFields.edited = true
        }
        return this.provider.update({ _id: this.provider.toObjectId(id) }, { $set: dataFields })
    }

    public async getNumberOfComments(query: any): Promise<number> {
        return this.provider.count(query)
    }

    async deleteComment(token: Token, commentId: string): Promise<Comment> {
        const comment: Comment = await this.getCommentById(commentId)
        if (!comment) {
            throw new PreconditionFailedException('The specified comment could not be found')
        }
        const report: Report = await this.reportsService.getReportById(comment.report_id)
        if (!report) {
            throw new PreconditionFailedException('The specified report could not be found')
        }
        if (!report.team_id || report.team_id == null || report.team_id === '') {
            throw new PreconditionFailedException('The specified report does not have a team associated')
        }
        const team: Team = await this.teamsService.getTeam({ filter: { _id: this.provider.toObjectId(report.team_id) } })
        if (!team) {
            throw new PreconditionFailedException('The specified team could not be found')
        }
        const userIsCommentCreator: boolean = comment.user_id === token.id
        const hasCommentPermissionAdmin: boolean = userHasPermission(token, CommentPermissionsEnum.ADMIN)
        const hasGlobalPermissionAdmin: boolean = userHasPermission(token, GlobalPermissionsEnum.GLOBAL_ADMIN)
        if (!userIsCommentCreator && !hasCommentPermissionAdmin && !hasGlobalPermissionAdmin) {
            throw new PreconditionFailedException('The specified user does not have permission to delete this comment')
        }
        await this.provider.deleteOne({ _id: this.provider.toObjectId(commentId) })
        return comment
    }

    async getComments(query): Promise<Comment[]> {
        return this.provider.read(query)
    }

    async getCommentWithChildren(commentId): Promise<Comment> {
        const comments: Comment[] = await this.provider.read({
            filter: { _id: this.provider.toObjectId(commentId) },
            limit: 1,
        })
        return comments.length === 0 ? null : comments[0]
    }

    public async getCommentById(id: string): Promise<Comment> {
        const comments: Comment[] = await this.provider.read({ filter: { _id: this.provider.toObjectId(id) } })
        return comments.length === 0 ? null : comments[0]
    }

    public async deleteReportComments(reportId: string): Promise<void> {
        await this.provider.deleteMany({ report_id: reportId })
    }

    public async deleteUserComments(userId: string): Promise<void> {
        await this.provider.deleteMany({ user_id: userId })
    }
}
