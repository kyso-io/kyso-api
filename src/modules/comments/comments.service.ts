import {
    Comment,
    CommentDto,
    CommentPermissionsEnum,
    Discussion,
    ElasticSearchIndex,
    GlobalPermissionsEnum,
    KysoCommentsCreateEvent,
    KysoCommentsDeleteEvent,
    KysoCommentsUpdateEvent,
    KysoDiscussionsNewMentionEvent,
    KysoEvent,
    KysoIndex,
    KysoSettingsEnum,
    Organization,
    Report,
    Team,
    TeamVisibilityEnum,
    Token,
    User,
} from '@kyso-io/kyso-model'
import { Inject, Injectable, Logger, PreconditionFailedException, Provider } from '@nestjs/common'
import { ClientProxy } from '@nestjs/microservices'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { userHasPermission } from '../../helpers/permissions'
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
                throw new PreconditionFailedException('The specified related comment could not be found')
            }
        }

        const report: Report = await this.reportsService.getReportById(commentDto.report_id)
        const discussion: Discussion = await this.discussionsService.getDiscussion({
            filter: { id: commentDto.discussion_id, mark_delete_at: { $eq: null } },
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
        this.client.emit<KysoCommentsCreateEvent>(KysoEvent.COMMENTS_CREATE, {
            user,
            organization,
            team,
            comment: commentDto,
            discussion,
            report,
        })

        if (discussion) {
            await this.checkMentionsInDiscussionComment(newComment, commentDto.user_ids)
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
                this.client.emit<KysoDiscussionsNewMentionEvent>(KysoEvent.DISCUSSIONS_NEW_MENTION, {
                    to: user.email,
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
            this.client.emit<KysoDiscussionsNewMentionEvent>(KysoEvent.DISCUSSIONS_MENTIONS, {
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
        this.client.emit<KysoCommentsUpdateEvent>(KysoEvent.COMMENTS_UPDATE, {
            user,
            organization,
            team,
            comment,
            discussion,
            report,
        })

        if (updatedComment?.discussion_id) {
            await this.discussionsService.checkParticipantsInDiscussion(updatedComment.discussion_id)
        }

        Logger.log(`Updating comment '${updatedComment.id}' of user '${updatedComment.user_id}' in Elasticsearch...`, CommentsService.name)
        const kysoIndex: KysoIndex = await this.commentToKysoIndex(updatedComment)
        this.fullTextSearchService.updateDocument(kysoIndex)

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
        const userIsCommentCreator: boolean = comment.user_id === token.id
        const hasCommentPermissionAdmin: boolean = userHasPermission(token, CommentPermissionsEnum.ADMIN)
        const hasGlobalPermissionAdmin: boolean = userHasPermission(token, GlobalPermissionsEnum.GLOBAL_ADMIN)
        if (!userIsCommentCreator && !hasCommentPermissionAdmin && !hasGlobalPermissionAdmin) {
            throw new PreconditionFailedException('The specified user does not have permission to delete this comment')
        }
        const relatedComments: Comment[] = await this.provider.read({
            filter: { comment_id: this.provider.toObjectId(commentId) },
        })
        comment = await this.provider.update({ _id: this.provider.toObjectId(comment.id) }, { $set: { mark_delete_at: new Date() } })

        this.client.emit<KysoCommentsDeleteEvent>(KysoEvent.COMMENTS_DELETE, {
            user: await this.usersService.getUserById(token.id),
            organization: await this.organizationsService.getOrganizationById(team.organization_id),
            team,
            comment,
            discussion,
            report,
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
            await this.provider.update({ _id: this.provider.toObjectId(comment.id) }, { $set: { mark_delete_at: new Date() } })
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
            team = await this.teamsService.getTeamById(report.team_id)
            organization = await this.organizationsService.getOrganizationById(team.organization_id)
            kysoIndex.isPublic = team.visibility === TeamVisibilityEnum.PUBLIC
        } else if (comment.discussion_id) {
            const discussion: Discussion = await this.discussionsService.getDiscussionById(comment.discussion_id)
            team = await this.teamsService.getTeamById(discussion.team_id)
            organization = await this.organizationsService.getOrganizationById(team.organization_id)
            kysoIndex.isPublic = team.visibility === TeamVisibilityEnum.PUBLIC
        }
        kysoIndex.organizationSlug = organization?.sluglified_name ? organization.sluglified_name : ''
        kysoIndex.teamSlug = team?.sluglified_name ? team.sluglified_name : ''

        if (comment?.user_ids && comment.user_ids.length > 0) {
            const users: User[] = await this.usersService.getUsers({ filter: { id: { $in: comment.user_ids } } })
            if (users.length > 0) {
                kysoIndex.people = users.map((user) => user.email).join(' ')
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
        return this.fullTextSearchService.indexDocument(kysoIndex)
    }
}
