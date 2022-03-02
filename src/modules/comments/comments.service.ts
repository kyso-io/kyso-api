import { Comment, CommentPermissionsEnum, Discussion, GlobalPermissionsEnum, Organization, Report, Team, Token, User } from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Injectable, Logger, PreconditionFailedException, Provider } from '@nestjs/common'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { userHasPermission } from '../../helpers/permissions'
import { DiscussionsService } from '../discussions/discussions.service'
import { KysoSettingsEnum } from '../kyso-settings/enums/kyso-settings.enum'
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { ReportsService } from '../reports/reports.service'
import { TeamsService } from '../teams/teams.service'
import { UsersService } from '../users/users.service'
import { CommentsMongoProvider } from './providers/mongo-comments.provider'

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
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    @Autowired({ typeName: 'TeamsService' })
    private teamsService: TeamsService

    @Autowired({ typeName: 'OrganizationsService' })
    private organizationsService: OrganizationsService

    @Autowired({ typeName: 'ReportsService' })
    private reportsService: ReportsService

    @Autowired({ typeName: 'DiscussionsService' })
    private discussionsService: DiscussionsService

    @Autowired({ typeName: 'KysoSettingsService' })
    private kysoSettingsService: KysoSettingsService

    constructor(private mailerService: MailerService, private readonly provider: CommentsMongoProvider) {
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

        const newComment: Comment = await this.createComment(comment)
        if (discussion) {
            await this.checkMentionsInDiscussionComment(newComment)
        }

        return newComment
    }

    private async checkMentionsInDiscussionComment(comment: Comment): Promise<void> {
        const discussion: Discussion = await this.discussionsService.getDiscussionById(comment.discussion_id)
        // Detect all mentions
        const regExpMentions = /@\[(.*?)\]\(.*?\)/g
        const matches = [...comment.text.matchAll(regExpMentions)]
        const userIds: string[] = [comment.user_id]
        if (matches) {
            const regExpUserId = /\(([^)]+)\)/
            matches.forEach((match) => {
                const matchesUserId = regExpUserId.exec(match[0])
                const userId = matchesUserId[1]
                if (!userIds.includes(userId)) {
                    userIds.push(userId)
                }
            })
        }
        const creator: User = await this.usersService.getUserById(comment.user_id)
        for (const userId of userIds) {
            const index: number = discussion.participants.findIndex((participant: string) => participant === userId)
            if (index === -1) {
                const user: User = await this.usersService.getUserById(userId)
                if (!user) {
                    Logger.error(`Could not find user with id ${userId}`, CommentsService.name)
                    continue
                }
                await this.discussionsService.addParticipantToDiscussion(discussion.id, userId)
                if (creator.id === userId) {
                    continue
                }
                const team: Team = await this.teamsService.getTeamById(discussion.team_id)
                const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
                const frontendUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL)

                this.mailerService
                    .sendMail({
                        to: user.email,
                        subject: 'You have been mentioned in a discussion',
                        html: `User ${creator.display_name} mentioned you in the discussion <a href="${frontendUrl}/${organization.sluglified_name}/${team.sluglified_name}/discussions/${discussion.id}">${discussion.title}</a>`,
                    })
                    .then((messageInfo) => {
                        Logger.log(`Mention in discussion mail ${messageInfo.messageId} sent to ${user.email}`, UsersService.name)
                    })
                    .catch((err) => {
                        Logger.error(`An error occurrend sending mention in discussion mail to ${user.email}`, err, UsersService.name)
                    })
            }
        }
    }

    async createComment(comment: Comment): Promise<Comment> {
        return this.provider.create(comment)
    }

    public async updateComment(token: Token, id: string, updateCommentRequest: Comment): Promise<Comment> {
        const comment: Comment = await this.getCommentById(id)
        if (!comment) {
            throw new PreconditionFailedException('The specified comment could not be found')
        }
        if (comment.mark_delete_at != null) {
            throw new PreconditionFailedException('The specified comment has been deleted')
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
        const updatedComment: Comment = await this.provider.update({ _id: this.provider.toObjectId(id) }, { $set: dataFields })
        if (updatedComment?.discussion_id) {
            await this.checkMentionsInDiscussionComment(updatedComment)
        }
        return updatedComment
    }

    public async getNumberOfComments(query: any): Promise<number> {
        return this.provider.count(query)
    }

    async deleteComment(token: Token, commentId: string): Promise<Comment> {
        let comment: Comment = await this.getCommentById(commentId)
        if (!comment) {
            throw new PreconditionFailedException('The specified comment could not be found')
        }
        if (comment?.report_id) {
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
        } else if (comment?.discussion_id) {
            const discussion: Discussion = await this.discussionsService.getDiscussionById(comment.discussion_id)
            if (!discussion) {
                throw new PreconditionFailedException('The specified discussion could not be found')
            }
            if (!discussion.team_id || discussion.team_id == null || discussion.team_id === '') {
                throw new PreconditionFailedException('The specified discussion does not have a team associated')
            }
            const team: Team = await this.teamsService.getTeam({ filter: { _id: this.provider.toObjectId(discussion.team_id) } })
            if (!team) {
                throw new PreconditionFailedException('The specified team could not be found')
            }
        } else {
            throw new PreconditionFailedException('The specified comment does not have a report or discussion associated')
        }
        const userIsCommentCreator: boolean = comment.user_id === token.id
        const hasCommentPermissionAdmin: boolean = userHasPermission(token, CommentPermissionsEnum.ADMIN)
        const hasGlobalPermissionAdmin: boolean = userHasPermission(token, GlobalPermissionsEnum.GLOBAL_ADMIN)
        if (!userIsCommentCreator && !hasCommentPermissionAdmin && !hasGlobalPermissionAdmin) {
            throw new PreconditionFailedException('The specified user does not have permission to delete this comment')
        }
        const relatedComments: Comment[] = await this.provider.read({
            filter: { comment_id: this.provider.toObjectId(commentId) },
        })
        if (relatedComments.length > 0) {
            comment = await this.provider.update({ _id: this.provider.toObjectId(comment.id) }, { $set: { mark_delete_at: new Date() } })
        } else {
            await this.provider.deleteOne({ _id: this.provider.toObjectId(commentId) })
        }
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
