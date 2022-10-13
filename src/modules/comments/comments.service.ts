import {
    Comment,
    CommentDto,
    CommentPermissionsEnum,
    Discussion,
    ElasticSearchIndex,
    KysoCommentsCreateEvent,
    KysoCommentsDeleteEvent,
    KysoCommentsUpdateEvent,
    KysoDiscussionsNewMentionEvent,
    KysoEventEnum,
    KysoIndex,
    KysoReportsMentionsEvent,
    KysoReportsNewMentionEvent,
    KysoSettingsEnum,
    Organization,
    Report,
    Team,
    TeamVisibilityEnum,
    Token,
    User,
} from '@kyso-io/kyso-model'
import { ForbiddenException, Inject, Injectable, Logger, NotFoundException, PreconditionFailedException, Provider } from '@nestjs/common'
import { ClientProxy } from '@nestjs/microservices'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { NATSHelper } from '../../helpers/natsHelper'
import { AuthService } from '../auth/auth.service'
import { DiscussionsService } from '../discussions/discussions.service'
import { FullTextSearchService } from '../full-text-search/full-text-search.service'
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

    @Autowired({ typeName: 'FullTextSearchService' })
    private fullTextSearchService: FullTextSearchService
    constructor(private readonly provider: CommentsMongoProvider, @Inject('NATS_SERVICE') private client: ClientProxy) {
        super()
    }

    async createCommentGivenToken(token: Token, commentDto: CommentDto): Promise<Comment> {
        if (commentDto?.comment_id) {
            const relatedComments: Comment[] = await this.provider.read({ filter: { _id: this.provider.toObjectId(commentDto.comment_id) } })
            if (relatedComments.length === 0) {
                throw new NotFoundException('The specified related comment could not be found')
            }
        }

        const report: Report = await this.reportsService.getReportById(commentDto.report_id)
        const discussion: Discussion = await this.discussionsService.getDiscussion({
            filter: { id: commentDto.discussion_id, mark_delete_at: { $eq: null } },
        })

        if (!report && !discussion) {
            throw new NotFoundException('The specified report or discussion could not be found')
        }

        if (!discussion && (!report.team_id || report.team_id == null || report.team_id === '')) {
            throw new NotFoundException('The specified report does not have a team associated')
        }

        if (!report && (!discussion.team_id || discussion.team_id == null || discussion.team_id === '')) {
            throw new NotFoundException('The specified discussion does not have a team associated')
        }

        const team: Team = await this.teamsService.getTeam({
            filter: {
                _id: this.provider.toObjectId(report ? report.team_id : discussion.team_id),
            },
        })

        if (!team) {
            throw new NotFoundException('The specified team could not be found')
        }

        const index: number = commentDto.user_ids.indexOf(token.id)
        if (index === -1) {
            commentDto.user_ids.push(token.id)
        }

        let newComment: Comment = new Comment(
            commentDto.text,
            commentDto.plain_text,
            token.id,
            commentDto.report_id,
            commentDto.discussion_id,
            commentDto.comment_id,
            commentDto.user_ids,
        )
        newComment = await this.createComment(newComment)

        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
        const user: User = await this.usersService.getUserById(token.id)

        if (newComment?.comment_id) {
            NATSHelper.safelyEmit<KysoCommentsCreateEvent>(this.client, KysoEventEnum.COMMENTS_REPLY, {
                user,
                organization,
                team,
                comment: newComment,
                discussion,
                report,
                frontendUrl: await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL),
            })
        } else {
            NATSHelper.safelyEmit<KysoCommentsCreateEvent>(this.client, KysoEventEnum.COMMENTS_CREATE, {
                user,
                organization,
                team,
                comment: newComment,
                discussion,
                report,
                frontendUrl: await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL),
            })
        }

        if (discussion) {
            await this.checkMentionsInDiscussionComment(newComment, commentDto.user_ids)
        } else if (report) {
            await this.checkMentionsInReportComment(newComment, commentDto.user_ids)
        }

        this.indexComment(newComment)

        return newComment
    }

    private async checkMentionsInDiscussionComment(comment: Comment, userIds: string[]): Promise<void> {
        const discussion: Discussion = await this.discussionsService.getDiscussionById(comment.discussion_id)
        userIds = [comment.user_id, ...userIds]
        const team: Team = await this.teamsService.getTeamById(discussion.team_id)
        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
        const frontendUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL)
        const creator: User = await this.usersService.getUserById(comment.user_id)
        const mentionedUsers: User[] = []
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        let checkParticipantsInDiscussion: boolean = false
        for (const userId of userIds) {
            const index: number = discussion.participants.findIndex((participant: string) => participant === userId)
            if (index === -1) {
                const user: User = await this.usersService.getUserById(userId)
                if (!user) {
                    Logger.error(`Could not find user with id ${userId}`, CommentsService.name)
                    continue
                }
                discussion.participants.push(userId)
                mentionedUsers.push(user)
                checkParticipantsInDiscussion = true
                if (creator.id === userId) {
                    continue
                }
                if (centralizedMails) {
                    continue
                }
                NATSHelper.safelyEmit<KysoDiscussionsNewMentionEvent>(this.client, KysoEventEnum.DISCUSSIONS_NEW_MENTION, {
                    user,
                    creator,
                    organization,
                    team,
                    discussion,
                    frontendUrl,
                })
            }
        }
        if (centralizedMails && organization.options.notifications.emails.length > 0 && mentionedUsers.length > 0) {
            const emails: string[] = organization.options.notifications.emails

            NATSHelper.safelyEmit<KysoDiscussionsNewMentionEvent>(this.client, KysoEventEnum.DISCUSSIONS_MENTIONS, {
                to: emails,
                creator,
                users: mentionedUsers,
                organization,
                team,
                discussion,
                frontendUrl,
            })
        }
        if (checkParticipantsInDiscussion) {
            await this.discussionsService.checkParticipantsInDiscussion(comment.discussion_id)
        }
    }

    private async checkMentionsInReportComment(comment: Comment, userIds: string[]): Promise<void> {
        const report: Report = await this.reportsService.getReportById(comment.report_id)
        const team: Team = await this.teamsService.getTeamById(report.team_id)
        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
        const frontendUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL)
        const creator: User = await this.usersService.getUserById(comment.user_id)
        const mentionedUsers: User[] = []
        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        // Remove the creator of the message from the users to notify
        const indexCreator: number = userIds.findIndex((userId: string) => userId === creator.id)
        if (indexCreator !== -1) {
            userIds.splice(indexCreator, 1)
        }
        for (const userId of userIds) {
            const user: User = await this.usersService.getUserById(userId)
            if (!user) {
                Logger.error(`Could not find user with id ${userId}`, CommentsService.name)
                continue
            }
            mentionedUsers.push(user)
            if (centralizedMails) {
                continue
            }
            NATSHelper.safelyEmit<KysoReportsNewMentionEvent>(this.client, KysoEventEnum.REPORTS_NEW_MENTION, {
                user,
                creator,
                organization,
                team,
                report,
                frontendUrl,
            })
        }
        if (centralizedMails && organization.options.notifications.emails.length > 0 && mentionedUsers.length > 0) {
            const emails: string[] = organization.options.notifications.emails
            NATSHelper.safelyEmit<KysoReportsMentionsEvent>(this.client, KysoEventEnum.REPORTS_MENTIONS, {
                to: emails,
                creator,
                users: mentionedUsers,
                organization,
                team,
                report,
                frontendUrl,
            })
        }
    }

    async createComment(comment: Comment): Promise<Comment> {
        return this.provider.create(comment)
    }

    public async updateComment(token: Token, id: string, updateCommentRequest: CommentDto): Promise<Comment> {
        const comment: Comment = await this.getCommentById(id)
        if (!comment) {
            throw new PreconditionFailedException('The specified comment could not be found')
        }
        if (comment.mark_delete_at != null) {
            throw new PreconditionFailedException('The specified comment has been deleted')
        }
        const dataFields: any = {
            text: updateCommentRequest.text,
            plain_text: updateCommentRequest.plain_text,
            marked: updateCommentRequest.marked,
            user_ids: updateCommentRequest.user_ids,
        }
        if (updateCommentRequest.marked) {
            dataFields.marked_by = token.id
        }
        if (comment.text !== updateCommentRequest.text) {
            dataFields.edited = true
        }
        const updatedComment: Comment = await this.provider.update({ _id: this.provider.toObjectId(id) }, { $set: dataFields })

        let discussion: Discussion = null
        let report: Report = null
        let teamId: string = ''
        if (comment.discussion_id) {
            discussion = await this.discussionsService.getDiscussionById(comment.discussion_id)
            teamId = discussion.team_id
        } else if (comment.report_id) {
            report = await this.reportsService.getReportById(comment.report_id)
            teamId = report.team_id
        }
        const team: Team = await this.teamsService.getTeamById(teamId)
        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
        const user: User = await this.usersService.getUserById(token.id)

        NATSHelper.safelyEmit<KysoCommentsUpdateEvent>(this.client, KysoEventEnum.COMMENTS_UPDATE, {
            user,
            organization,
            team,
            comment,
            discussion,
            report,
            frontendUrl: await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL),
        })

        if (updatedComment?.discussion_id) {
            await this.discussionsService.checkParticipantsInDiscussion(updatedComment.discussion_id)
        }

        Logger.log(`Updating comment '${updatedComment.id}' of user '${updatedComment.user_id}' in Elasticsearch...`, CommentsService.name)
        const kysoIndex: KysoIndex = await this.commentToKysoIndex(updatedComment)
        if (kysoIndex) {
            this.fullTextSearchService.updateDocument(kysoIndex)
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
        let team: Team = null
        let report: Report = null
        let discussion: Discussion = null
        if (comment?.report_id) {
            report = await this.reportsService.getReportById(comment.report_id)
            if (!report) {
                throw new PreconditionFailedException('The specified report could not be found')
            }
            if (!report.team_id || report.team_id == null || report.team_id === '') {
                throw new PreconditionFailedException('The specified report does not have a team associated')
            }
            team = await this.teamsService.getTeam({ filter: { _id: this.provider.toObjectId(report.team_id) } })
            if (!team) {
                throw new PreconditionFailedException('The specified team could not be found')
            }
        } else if (comment?.discussion_id) {
            discussion = await this.discussionsService.getDiscussionById(comment.discussion_id)
            if (!discussion) {
                throw new PreconditionFailedException('The specified discussion could not be found')
            }
            if (!discussion.team_id || discussion.team_id == null || discussion.team_id === '') {
                throw new PreconditionFailedException('The specified discussion does not have a team associated')
            }
            team = await this.teamsService.getTeam({ filter: { _id: this.provider.toObjectId(discussion.team_id) } })
            if (!team) {
                throw new PreconditionFailedException('The specified team could not be found')
            }
        } else {
            throw new PreconditionFailedException('The specified comment does not have a report or discussion associated')
        }
        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
        if (!organization) {
            throw new PreconditionFailedException('The specified organization could not be found')
        }
        const userIsCommentCreator: boolean = comment.user_id === token.id
        if (!userIsCommentCreator) {
            const hasPermissions: boolean = AuthService.hasPermissions(token, [CommentPermissionsEnum.DELETE], team.id, organization.id)
            if (!hasPermissions) {
                throw new ForbiddenException('You do not have permissions to delete this comment')
            }
        }
        comment = await this.provider.update({ _id: this.provider.toObjectId(comment.id) }, { $set: { mark_delete_at: new Date() } })

        NATSHelper.safelyEmit<KysoCommentsDeleteEvent>(this.client, KysoEventEnum.COMMENTS_DELETE, {
            user: await this.usersService.getUserById(token.id),
            organization: await this.organizationsService.getOrganizationById(team.organization_id),
            team,
            comment,
            discussion,
            report,
            frontendUrl: await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL),
        })

        if (discussion) {
            await this.discussionsService.checkParticipantsInDiscussion(discussion.id)
        }

        Logger.log(`Deleting comment '${comment.id}' of user '${comment.user_id}' in ElasticSearch...`, CommentsService.name)
        this.fullTextSearchService.deleteDocument(ElasticSearchIndex.Comment, comment.id)

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
        const comments: Comment[] = await this.provider.read({ filter: { report_id: reportId } })
        for (const comment of comments) {
            await this.provider.deleteOne({ _id: this.provider.toObjectId(comment.id) })
            Logger.log(`Deleting comment '${comment.id}' of user '${comment.user_id}' in ElasticSearch...`, CommentsService.name)
            this.fullTextSearchService.deleteDocument(ElasticSearchIndex.Comment, comment.id)
        }
    }

    public async deleteUserComments(userId: string): Promise<void> {
        const comments: Comment[] = await this.provider.read({ filter: { user_id: userId } })
        for (const comment of comments) {
            await this.provider.update({ _id: this.provider.toObjectId(comment.id) }, { $set: { mark_delete_at: new Date() } })
            Logger.log(`Deleting comment '${comment.id}' of user '${comment.user_id}' in ElasticSearch...`, CommentsService.name)
            this.fullTextSearchService.deleteDocument(ElasticSearchIndex.Comment, comment.id)
        }
    }

    private async commentToKysoIndex(comment: Comment): Promise<KysoIndex> {
        const kysoIndex: KysoIndex = new KysoIndex()
        kysoIndex.title = comment.plain_text
        kysoIndex.content = comment.plain_text
        kysoIndex.type = ElasticSearchIndex.Comment
        kysoIndex.entityId = comment.id

        let organization: Organization = null
        let team: Team = null
        if (comment.report_id) {
            const report: Report = await this.reportsService.getReportById(comment.report_id)
            if (!report) {
                Logger.error(`Report ${comment.report_id} could not be found`, CommentsService.name)
                return null
            }
            team = await this.teamsService.getTeamById(report.team_id)
            if (!team) {
                Logger.error(`Team ${report.team_id} could not be found for comment ${comment.comment_id}`, CommentsService.name)
                return null
            }
            organization = await this.organizationsService.getOrganizationById(team.organization_id)
            if (!organization) {
                Logger.error(
                    `Organization ${team.organization_id} could not be found for team ${team.id} and comment ${comment.comment_id}`,
                    CommentsService.name,
                )
                return null
            }
            kysoIndex.isPublic = team.visibility === TeamVisibilityEnum.PUBLIC
            kysoIndex.link = `/${organization.sluglified_name}/${team.sluglified_name}/${report.sluglified_name}`
        } else if (comment.discussion_id) {
            const discussion: Discussion = await this.discussionsService.getDiscussionById(comment.discussion_id)
            if (!discussion) {
                Logger.error(`Discussion ${comment.discussion_id} could not be found`, CommentsService.name)
                return null
            }
            team = await this.teamsService.getTeamById(discussion.team_id)
            if (!team) {
                Logger.error(`Team ${discussion.team_id} could not be found for comment ${comment.comment_id}`, CommentsService.name)
                return null
            }
            organization = await this.organizationsService.getOrganizationById(team.organization_id)
            if (!organization) {
                Logger.error(
                    `Organization ${team.organization_id} could not be found for team ${team.id} and comment ${comment.comment_id}`,
                    CommentsService.name,
                )
                return null
            }
            kysoIndex.isPublic = team.visibility === TeamVisibilityEnum.PUBLIC
            kysoIndex.link = `/${organization.sluglified_name}/${team.sluglified_name}/discussions/${discussion.id}`
        }
        kysoIndex.organizationSlug = organization?.sluglified_name ? organization.sluglified_name : ''
        kysoIndex.teamSlug = team?.sluglified_name ? team.sluglified_name : ''

        if (comment.user_id) {
            const user: User = await this.usersService.getUserById(comment.user_id)
            if (user) {
                kysoIndex.people.push(user.email)
            }
        }
        if (comment?.user_ids && comment.user_ids.length > 0) {
            for (const userId of comment.user_ids) {
                const user: User = await this.usersService.getUserById(userId)
                if (user) {
                    const index: number = kysoIndex.people.indexOf(user.email)
                    if (index === -1) {
                        kysoIndex.people.push(user.email)
                    }
                }
            }
        }

        return kysoIndex
    }

    public async reindexComments(): Promise<void> {
        const comments: Comment[] = await this.provider.read({})
        await this.fullTextSearchService.deleteAllDocumentsOfType(ElasticSearchIndex.Comment)
        for (const comment of comments) {
            await this.indexComment(comment)
        }
    }

    private async indexComment(comment: Comment): Promise<any> {
        Logger.log(`Indexing comment '${comment.id}' of user '${comment.user_id}'`, CommentsService.name)
        const kysoIndex: KysoIndex = await this.commentToKysoIndex(comment)
        if (kysoIndex) {
            return this.fullTextSearchService.indexDocument(kysoIndex)
        } else {
            return null
        }
    }
}
