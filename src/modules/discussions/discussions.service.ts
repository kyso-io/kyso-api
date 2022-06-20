import {
    CreateDiscussionRequestDTO,
    Discussion,
    KysoCommentsDeleteEvent,
    KysoDiscussionsAssigneeEvent,
    KysoDiscussionsCreateEvent,
    KysoDiscussionsUpdateEvent,
    KysoEvent,
    KysoSettingsEnum,
    Organization,
    Team,
    Token,
    UpdateDiscussionRequestDTO,
    User,
} from '@kyso-io/kyso-model'
import { Inject, Injectable, Logger, PreconditionFailedException, Provider } from '@nestjs/common'
import { ClientProxy } from '@nestjs/microservices'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { GenericService } from '../../generic/service.generic'
import { PlatformRole } from '../../security/platform-roles'
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

        this.client.emit<KysoDiscussionsCreateEvent>(KysoEvent.DISCUSSIONS_CREATE, {
            user: author,
            organization,
            team,
            discussion,
            frontendUrl: await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL),
        })

        return discussion
    }

    public async addParticipantToDiscussion(reportId: string, userId: string): Promise<Discussion> {
        return this.provider.update(
            { _id: this.provider.toObjectId(reportId) },
            {
                $push: {
                    participants: userId,
                },
            },
        )
    }

    public async removeParticipantFromDiscussion(reportId: string, userId: string): Promise<Discussion> {
        return this.provider.update(
            { _id: this.provider.toObjectId(reportId) },
            {
                $pull: {
                    participants: userId,
                },
            },
        )
    }

    public async updateDiscussion(id: string, data: UpdateDiscussionRequestDTO): Promise<Discussion> {
        let discussion: Discussion = await this.getDiscussion({ filter: { id: id, mark_delete_at: { $eq: null } } })
        const user: User = await this.usersService.getUserById(discussion.user_id)
        const team: Team = await this.teamsService.getTeamById(discussion.team_id)
        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
        const frontendUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL)

        if (!discussion || !team || !organization) {
            Logger.error(`Discussion: ${discussion.id}`)
            Logger.error(`Team: ${team.id}`)
            Logger.error(`Organization: ${organization.id}`)
            throw new PreconditionFailedException('Discussion, team or organization not found')
        }

        // SEND NOTIFICATIONS
        try {
            const processedAssignees = []
            const authorUser: User = await this.usersService.getUserById(discussion.user_id)
            const isCentralized: boolean = organization?.options?.notifications?.centralized || false
            let emailsCentralized: string[] = []

            if (isCentralized) {
                emailsCentralized = organization.options.notifications.emails
            }

            // Notify when a new assignment is settled
            for (const dbAssignee of data.assignees) {
                const existsInNewAssignees = discussion.assignees.find((incomingAssignee) => dbAssignee === incomingAssignee)

                if (!existsInNewAssignees) {
                    // It's a new assignee. Notify to creator and added assignee
                    const assigneeUser: User = await this.usersService.getUserById(dbAssignee)

                    // To the assignee
                    this.client.emit<KysoDiscussionsAssigneeEvent>(KysoEvent.DISCUSSIONS_NEW_ASSIGNEE, {
                        to: assigneeUser.email,
                        organization,
                        team,
                        discussion,
                        frontendUrl,
                    })

                    // To the author
                    this.client.emit<KysoDiscussionsAssigneeEvent>(KysoEvent.DISCUSSIONS_USER_ASSIGNED, {
                        to: isCentralized ? emailsCentralized : authorUser.email,
                        assigneeUser: assigneeUser,
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
                console.log(`Removed ${removedAssignees}`)

                for (const removed of removedAssignees) {
                    const removedUser: User = await this.usersService.getUserById(removed)

                    // To the assignee
                    this.client.emit<KysoDiscussionsAssigneeEvent>(KysoEvent.DISCUSSIONS_REMOVE_ASSIGNEE, {
                        to: removedUser.email,
                        organization,
                        team,
                        discussion,
                        frontendUrl,
                    })

                    // To the author
                    this.client.emit<KysoDiscussionsAssigneeEvent>(KysoEvent.DISCUSSIONS_USER_UNASSIGNED, {
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

        this.client.emit<KysoDiscussionsUpdateEvent>(KysoEvent.DISCUSSIONS_UPDATE, {
            user,
            organization,
            team,
            discussion,
            frontendUrl,
        })

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
        this.client.emit<KysoCommentsDeleteEvent>(KysoEvent.DISCUSSIONS_DELETE, {
            user,
            organization,
            team,
            discussion,
            frontendUrl: await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL),
        })

        return discussion
    }
}
