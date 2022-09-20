import {
    Comment,
    CreateDiscussionRequestDTO,
    Discussion,
    DiscussionPermissionsEnum,
    ElasticSearchIndex,
    KysoCommentsDeleteEvent,
    KysoDiscussionsAssigneeEvent,
    KysoDiscussionsCreateEvent,
    KysoDiscussionsUpdateEvent,
    KysoEventEnum,
    KysoIndex,
    KysoSettingsEnum,
    Organization,
    Team,
    TeamVisibilityEnum,
    Token,
    UpdateDiscussionRequestDTO,
    User,
} from '@kyso-io/kyso-model'
import { ForbiddenException, Inject, Injectable, Logger, NotFoundException, PreconditionFailedException, Provider } from '@nestjs/common'
import { ClientProxy } from '@nestjs/microservices'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { GenericService } from '../../generic/service.generic'
import { NATSHelper } from '../../helpers/natsHelper'
import { PlatformRole } from '../../security/platform-roles'
import { AuthService } from '../auth/auth.service'
import { CommentsService } from '../comments/comments.service'
import { FullTextSearchService } from '../full-text-search/full-text-search.service'
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { TeamsService } from '../teams/teams.service'
import { UsersService } from '../users/users.service'
import { DiscussionsMongoProvider } from './providers/discussions-mongo.provider'

function factory(service: DiscussionsService) {
    return service
}

export function createProvider(): Provider<DiscussionsService> {
    return {
        provide: `${DiscussionsService.name}`,
        useFactory: (service) => factory(service),
        inject: [DiscussionsService],
    }
}

@Injectable()
export class DiscussionsService extends AutowiredService implements GenericService<Discussion> {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    @Autowired({ typeName: 'TeamsService' })
    private teamsService: TeamsService

    @Autowired({ typeName: 'OrganizationsService' })
    private organizationsService: OrganizationsService

    @Autowired({ typeName: 'KysoSettingsService' })
    private kysoSettingsService: KysoSettingsService

    @Autowired({ typeName: 'FullTextSearchService' })
    private fullTextSearchService: FullTextSearchService

    @Autowired({ typeName: 'CommentsService' })
    private commentsService: CommentsService

    constructor(private readonly provider: DiscussionsMongoProvider, @Inject('NATS_SERVICE') private client: ClientProxy) {
        super()
    }

    async checkOwnership(item: Discussion, requester: Token, organizationName: string, teamName: string): Promise<boolean> {
        let hasAdequatePermissions

        // Check if the user who is requesting the edition of the discussion is the owner of the discussion
        if (item.user_id === requester.id) {
            hasAdequatePermissions = true
        } else {
            hasAdequatePermissions = false
        }

        if (!hasAdequatePermissions) {
            // Check if the user who is requesting the edition of the discussion has TEAM_ADMIN or ORG_ADMIN
            const teamPermissions = requester.permissions.teams.find((x) => x.name === teamName)

            if (teamPermissions && teamPermissions.role_names) {
                const isTeamAdmin = teamPermissions.role_names.find((x) => x === PlatformRole.TEAM_ADMIN_ROLE.name) !== undefined
                const isOrgAdmin = teamPermissions.role_names.find((x) => x === PlatformRole.ORGANIZATION_ADMIN_ROLE.name) !== undefined
                const isPlatformAdmin = teamPermissions.role_names.find((x) => x === PlatformRole.PLATFORM_ADMIN_ROLE.name) !== undefined

                if (isTeamAdmin || isOrgAdmin || isPlatformAdmin) {
                    hasAdequatePermissions = true
                } else {
                    hasAdequatePermissions = false
                }
            }
        }

        return hasAdequatePermissions
    }

    public getDiscussions(query: any): Promise<Discussion[]> {
        return this.provider.read(query)
    }

    public async getDiscussion(query: any): Promise<Discussion> {
        const discussions: Discussion[] = await this.provider.read(query)
        return discussions.length > 0 ? discussions[0] : null
    }

    public async getDiscussionById(discussionId: string): Promise<Discussion> {
        return this.getDiscussion({ filter: { _id: this.provider.toObjectId(discussionId) } })
    }

    public async createDiscussion(data: CreateDiscussionRequestDTO): Promise<Discussion> {
        const author: User = await this.usersService.getUserById(data.user_id)
        for (const participant_id of data.participants) {
            const participant: User = await this.usersService.getUserById(participant_id)
            if (!participant) {
                throw new PreconditionFailedException('Participant not found')
            }
        }

        const index: number = data.participants.indexOf(author.id)
        if (index === -1) {
            data.participants.push(author.id)
        }

        const team: Team = await this.teamsService.getTeamById(data.team_id)
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }

        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)

        if (!data.assignees || data.assignees.length === 0) {
            data.assignees = [data.user_id]
        }

        let discussion: Discussion = new Discussion(
            data.answered,
            data.assignees,
            data.user_id,
            data.closed,
            data.description,
            data.discussion_number,
            data.main,
            author.display_name,
            data.participants,
            data.request_private,
            data.team_id,
            data.title,
            data.url_name,
        )
        discussion = await this.provider.create(discussion)

        NATSHelper.safelyEmit<KysoDiscussionsCreateEvent>(this.client, KysoEventEnum.DISCUSSIONS_CREATE, {
            user: author,
            organization,
            team,
            discussion,
            frontendUrl: await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL),
        })

        this.indexDiscussion(discussion)

        return discussion
    }

    public async checkParticipantsInDiscussion(discussionId: string): Promise<Discussion> {
        let discussion: Discussion = await this.getDiscussionById(discussionId)
        const comments: Comment[] = await this.commentsService.getComments({ filter: { discussion_id: discussionId } })
        const participants: string[] = [discussion.user_id]
        for (const comment of comments) {
            const usersIds: string[] = [comment.user_id, ...comment.user_ids]
            for (const userId of usersIds) {
                const index: number = participants.indexOf(userId)
                if (index === -1) {
                    participants.push(userId)
                }
            }
        }

        discussion = await this.provider.update(
            { _id: this.provider.toObjectId(discussionId) },
            {
                $set: {
                    participants,
                },
            },
        )

        const kysoIndex: KysoIndex = await this.discussionToKysoIndex(discussion)
        if (kysoIndex) {
            this.fullTextSearchService.updateDocument(kysoIndex)
        }

        return discussion
    }

    public async removeParticipantFromDiscussion(reportId: string, userId: string): Promise<Discussion> {
        const discussion: Discussion = await this.provider.update(
            { _id: this.provider.toObjectId(reportId) },
            {
                $pull: {
                    participants: userId,
                },
            },
        )

        const kysoIndex: KysoIndex = await this.discussionToKysoIndex(discussion)
        if (kysoIndex) {
            this.fullTextSearchService.updateDocument(kysoIndex)
        }

        return discussion
    }

    public async updateDiscussion(token: Token, id: string, data: UpdateDiscussionRequestDTO): Promise<Discussion> {
        let discussion: Discussion = await this.getDiscussion({ filter: { id: id, mark_delete_at: { $eq: null } } })
        if (!discussion) {
            throw new NotFoundException('Discussion not found')
        }
        const team: Team = await this.teamsService.getTeamById(discussion.team_id)
        if (!team) {
            throw new NotFoundException('Team not found')
        }
        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
        if (!organization) {
            throw new NotFoundException('Organization not found')
        }
        if (discussion.user_id !== token.id) {
            const hasPermissions: boolean = AuthService.hasPermissions(token, [DiscussionPermissionsEnum.EDIT], team.id, organization.id)
            if (!hasPermissions) {
                throw new ForbiddenException('You do not have permissions to update this discussion')
            }
        }
        const frontendUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL)

        // SEND NOTIFICATIONS
        try {
            const processedAssignees = []
            const authorUser: User = await this.usersService.getUserById(discussion.user_id)
            const isCentralized: boolean = organization?.options?.notifications?.centralized || false
            let emailsCentralized: string[] = []

            if (isCentralized) {
                emailsCentralized = organization.options.notifications.emails
            }

            const user: User = await this.usersService.getUserById(token.id)

            // Notify when a new assignment is settled
            for (const dbAssignee of data.assignees) {
                const existsInNewAssignees = discussion.assignees.find((incomingAssignee) => dbAssignee === incomingAssignee)

                if (!existsInNewAssignees) {
                    // It's a new assignee. Notify to creator and added assignee
                    const assigneeUser: User = await this.usersService.getUserById(dbAssignee)

                    // To the assignee
                    NATSHelper.safelyEmit<KysoDiscussionsAssigneeEvent>(this.client, KysoEventEnum.DISCUSSIONS_NEW_ASSIGNEE, {
                        user,
                        to: assigneeUser.email,
                        assigneeUser,
                        organization,
                        team,
                        discussion,
                        frontendUrl,
                    })

                    // To the author
                    NATSHelper.safelyEmit<KysoDiscussionsAssigneeEvent>(this.client, KysoEventEnum.DISCUSSIONS_USER_ASSIGNED, {
                        user,
                        to: isCentralized ? emailsCentralized : authorUser.email,
                        assigneeUser,
                        organization,
                        team,
                        discussion,
                        frontendUrl,
                    })
                } // else { // Was already in the assignee list, nothing to do }

                processedAssignees.push(dbAssignee)
            }

            const removedAssignees = discussion.assignees.filter((x) => processedAssignees.indexOf(x) === -1)

            if (removedAssignees) {
                // Notify to removed assignees and creator

                for (const removed of removedAssignees) {
                    const removedUser: User = await this.usersService.getUserById(removed)

                    // To the assignee
                    NATSHelper.safelyEmit<KysoDiscussionsAssigneeEvent>(this.client, KysoEventEnum.DISCUSSIONS_REMOVE_ASSIGNEE, {
                        user,
                        to: removedUser.email,
                        assigneeUser: removedUser,
                        organization,
                        team,
                        discussion,
                        frontendUrl,
                    })

                    // To the author
                    NATSHelper.safelyEmit<KysoDiscussionsAssigneeEvent>(this.client, KysoEventEnum.DISCUSSIONS_USER_UNASSIGNED, {
                        user,
                        to: isCentralized ? emailsCentralized : authorUser.email,
                        assigneeUser: removedUser,
                        organization,
                        team,
                        discussion,
                        frontendUrl,
                    })
                }
            }
        } catch (ex) {
            Logger.error('Error sending notifications to new assignees in a discussion', ex)
        }

        discussion = await this.provider.update(
            { _id: this.provider.toObjectId(discussion.id) },
            {
                $set: {
                    answered: data.answered,
                    assignees: data.assignees,
                    closed: data.closed,
                    description: data.description,
                    discussion_number: data.discussion_number,
                    edited: true,
                    main: data.main,
                    participants: data.participants,
                    request_private: data.request_private,
                    title: data.title,
                    url_name: data.url_name,
                },
            },
        )

        NATSHelper.safelyEmit<KysoDiscussionsUpdateEvent>(this.client, KysoEventEnum.DISCUSSIONS_UPDATE, {
            user: await this.usersService.getUserById(token.id),
            organization,
            team,
            discussion,
            frontendUrl,
        })

        const kysoIndex: KysoIndex = await this.discussionToKysoIndex(discussion)
        if (kysoIndex) {
            this.fullTextSearchService.updateDocument(kysoIndex)
        }

        return discussion
    }

    public async deleteDiscussion(id: string): Promise<Discussion> {
        let discussion: Discussion = await this.getDiscussion({ filter: { _id: this.provider.toObjectId(id) } })
        if (!discussion) {
            throw new PreconditionFailedException('Discussion not found')
        }
        if (discussion?.mark_delete_at) {
            throw new PreconditionFailedException('Discussion already deleted')
        }
        discussion = await this.provider.update(
            { _id: this.provider.toObjectId(discussion.id) },
            {
                $set: { mark_delete_at: new Date() },
            },
        )

        const user: User = await this.usersService.getUserById(discussion.user_id)
        const team: Team = await this.teamsService.getTeamById(discussion.team_id)
        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)

        NATSHelper.safelyEmit<KysoCommentsDeleteEvent>(this.client, KysoEventEnum.DISCUSSIONS_DELETE, {
            user,
            organization,
            team,
            discussion,
            frontendUrl: await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL),
        })

        Logger.log(`Deleting discussion '${discussion.id} ${discussion.title}' in ElasticSearch...`, UsersService.name)
        this.fullTextSearchService.deleteDocument(ElasticSearchIndex.Discussion, discussion.id)

        return discussion
    }

    private async discussionToKysoIndex(discussion: Discussion): Promise<KysoIndex> {
        const team: Team = await this.teamsService.getTeamById(discussion.team_id)
        if (!team) {
            Logger.error(`Team '${discussion.team_id}' not found for discussion '${discussion.id}'`, DiscussionsService.name)
            return null
        }
        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
        if (!organization) {
            Logger.error(
                `Organization '${team.organization_id}' not found for team '${discussion.id}' and discussion '${discussion.id}'`,
                DiscussionsService.name,
            )
            return null
        }
        let users: User[] = []
        if (discussion.participants) {
            users = await this.usersService.getUsers({
                filter: { id: { $in: [...discussion.participants, discussion.user_id] } },
            })
        }
        const kysoIndex: KysoIndex = new KysoIndex()
        kysoIndex.title = discussion.title
        kysoIndex.type = ElasticSearchIndex.Discussion
        kysoIndex.entityId = discussion.id
        kysoIndex.organizationSlug = organization.sluglified_name
        kysoIndex.teamSlug = team.sluglified_name
        kysoIndex.people = users.map((user) => user.email)
        kysoIndex.content = discussion.main
        kysoIndex.isPublic = team.visibility === TeamVisibilityEnum.PUBLIC
        kysoIndex.link = `/${organization.sluglified_name}/${team.sluglified_name}/discussions/${discussion.id}`
        return kysoIndex
    }

    public async reindexDiscussions(): Promise<void> {
        const discussions: Discussion[] = await this.getDiscussions({ filter: { mark_delete_at: null } })
        await this.fullTextSearchService.deleteAllDocumentsOfType(ElasticSearchIndex.Discussion)
        for (const discussion of discussions) {
            await this.indexDiscussion(discussion)
        }
    }

    private async indexDiscussion(discussion: Discussion): Promise<any> {
        Logger.log(`Indexing discussion '${discussion.id} ${discussion.title}'...`, UsersService.name)
        const kysoIndex: KysoIndex = await this.discussionToKysoIndex(discussion)
        if (kysoIndex) {
            return this.fullTextSearchService.indexDocument(kysoIndex)
        } else {
            return null
        }
    }
}
