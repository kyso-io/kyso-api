import { Inject, Injectable, PreconditionFailedException, Provider } from '@nestjs/common'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { userHasPermission } from '../../helpers/permissions'
import { reportsService, teamsService } from '../../main'
import { Comment } from '../../model/comment.model'
import { Report } from '../../model/report.model'
import { Team } from '../../model/team.model'
import { Token } from '../../model/token.model'
import { GlobalPermissionsEnum } from '../../security/general-permissions.enum'
import { CommentsMongoProvider } from './providers/mongo-comments.provider'
import { CommentPermissionsEnum } from './security/comment-permissions.enum'

function factory(service: CommentsService) {
    return service;
}
  
export function createProvider(): Provider<CommentsService> {
    return {
        provide: `${CommentsService.name}`,
        useFactory: service => factory(service),
        inject: [CommentsService],
    };
}

@Injectable()
export class CommentsService extends AutowiredService {
    
    constructor(private readonly provider: CommentsMongoProvider) {
        super()
    }

    async createComment(comment: Comment): Promise<Comment> {
        if (comment?.comment_id) {
            const relatedComments: Comment[] = await this.provider.read({ filter: { _id: this.provider.toObjectId(comment.comment_id) } })
            if (relatedComments.length === 0) {
                throw new PreconditionFailedException('The specified related comment could not be found')
            }
        }
        const report: Report = await reportsService.getById(comment.report_id)
        if (!report) {
            throw new PreconditionFailedException('The specified report could not be found')
        }
        if (!report.team_id || report.team_id == null || report.team_id === '') {
            throw new PreconditionFailedException('The specified report does not have a team associated')
        }
        const team: Team = await teamsService.getTeam({ filter: { _id: this.provider.toObjectId(report.team_id) } })
        if (!team) {
            throw new PreconditionFailedException('The specified team could not be found')
        }
        const userTeams: Team[] = await teamsService.getTeamsVisibleForUser(comment.user_id)
        if (!userTeams.find((t: Team) => t.id === team.id)) {
            throw new PreconditionFailedException('The specified user does not belong to the team of the specified report')
        }
        return this.provider.create(comment)
    }

    async deleteComment(token: Token, id: string): Promise<Comment> {
        const comments: Comment[] = await this.provider.read({ filter: { _id: this.provider.toObjectId(id) } })
        if (comments.length === 0) {
            throw new PreconditionFailedException('The specified comment could not be found')
        }
        const comment: Comment = comments[0]
        const report: Report = await reportsService.getById(comment.report_id)
        if (!report) {
            throw new PreconditionFailedException('The specified report could not be found')
        }
        if (!report.team_id || report.team_id == null || report.team_id === '') {
            throw new PreconditionFailedException('The specified report does not have a team associated')
        }
        const team: Team = await teamsService.getTeam({ filter: { _id: this.provider.toObjectId(report.team_id) } })
        if (!team) {
            throw new PreconditionFailedException('The specified team could not be found')
        }
        const userIsCommentCreator: boolean = comment.user_id === token.id
        const hasCommentPermissionAdmin: boolean = userHasPermission(token, CommentPermissionsEnum.ADMIN)
        const hasGlobalPermissionAdmin: boolean = userHasPermission(token, GlobalPermissionsEnum.GLOBAL_ADMIN)
        if (!userIsCommentCreator && !hasCommentPermissionAdmin && !hasGlobalPermissionAdmin) {
            throw new PreconditionFailedException('The specified user does not have permission to delete this comment')
        }
        await this.provider.delete({ _id: this.provider.toObjectId(id) })
        return comment
    }

    async getComments(query) {
        const comments = await this.provider.read({
            filter: query,
            sort: { _created_at: -1 },
        })

        return comments
    }

    async getCommentWithChildren(commentId) {
        const comments = await this.provider.read({
            filter: { _id: commentId },
            limit: 1,
        })

        if (comments.length === 0) {
            return {}
        }

        return comments
        // const reportComments = await this.getReportComments(comments[0].report_id)

        // return reportComments.find((comment) => comment.id === commentId)
    }
}
