import { CreateDiscussionRequestDTO, Discussion, Organization, Team, Token, UpdateDiscussionRequestDTO, User } from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Injectable, Logger, PreconditionFailedException, Provider } from '@nestjs/common'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { KysoSettingsEnum } from '@kyso-io/kyso-model'
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { TeamsService } from '../teams/teams.service'
import { UsersService } from '../users/users.service'
import { DiscussionsMongoProvider } from './providers/discussions-mongo.provider'
import { GenericService } from '../../generic/service.generic'
import { PlatformRole } from '../../security/platform-roles'
import { auth } from 'google-auth-library'

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

    constructor(private readonly mailerService: MailerService, private readonly provider: DiscussionsMongoProvider) {
        super()
    }

    async checkOwnership(item: Discussion, requester: Token, organizationName: string, teamName: string): Promise<boolean> {
        let hasAdequatePermissions
        
        // Check if the user who is requesting the edition of the discussion is the owner of the discussion
        if(item.user_id === requester.id) {
            hasAdequatePermissions = true 
        } else {
            hasAdequatePermissions = false 
        }

        if(!hasAdequatePermissions) {
            // Check if the user who is requesting the edition of the discussion has TEAM_ADMIN or ORG_ADMIN
            const teamPermissions = requester.permissions.teams.find(x => x.name === teamName)

            if(teamPermissions && teamPermissions.role_names) {
                const isTeamAdmin = teamPermissions.role_names.find(x => x === PlatformRole.TEAM_ADMIN_ROLE.name) !== undefined 
                const isOrgAdmin = teamPermissions.role_names.find(x => x === PlatformRole.ORGANIZATION_ADMIN_ROLE.name) !== undefined
                const isPlatformAdmin = teamPermissions.role_names.find(x => x === PlatformRole.PLATFORM_ADMIN_ROLE.name) !== undefined

                if(isTeamAdmin || isOrgAdmin || isPlatformAdmin) {
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
        if (!author) {
            throw new PreconditionFailedException('Author not found')
        }

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

        const centralizedMails: boolean = organization?.options?.notifications?.centralized || false
        const emails: string[] = organization?.options?.notifications?.emails || []
        const frontendUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL)
        const to = centralizedMails && emails.length > 0 ? emails : author.email

        this.mailerService
            .sendMail({
                to,
                subject: `New discussion ${discussion.title} created`,
                template: 'discussion-new',
                context: {
                    frontendUrl,
                    organization,
                    team,
                    discussion,
                },
            })
            .then((messageInfo) => {
                Logger.log(`Discussion mail ${messageInfo.messageId} sent to ${Array.isArray(to) ? to.join(', ') : to}`, DiscussionsService.name)
            })
            .catch((err) => {
                Logger.error(`An error occurred sending discussion mail to ${Array.isArray(to) ? to.join(', ') : to}`, err, DiscussionsService.name)
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
        const discussion: Discussion = await this.getDiscussion({ filter: { id: id, mark_delete_at: { $eq: null } } })
        const team: Team = await this.teamsService.getTeamById(discussion.team_id)
        const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id)
        const frontendUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL)

        if (!discussion || ! team || !organization) {
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
            
            if(isCentralized) {
                emailsCentralized = organization.options.notifications.emails
            }
            
            // Notify when a new assignment is settled
            for(const dbAssignee of data.assignees) {
                const existsInNewAssignees = discussion.assignees.find(incomingAssignee => dbAssignee === incomingAssignee)

                if(!existsInNewAssignees) {
                    // It's a new assignee. Notify to creator and added assignee
                    const assigneeUser: User = await this.usersService.getUserById(dbAssignee)
                    
                    // To the assignee
                    this.mailerService
                        .sendMail({
                            to: assigneeUser.email,
                            subject: `You were assigned to the discussion ${discussion.title}`,
                            template: "discussion-you-were-added-as-assignee",
                            context: {
                                organization,
                                team,
                                discussion,
                                frontendUrl,
                            },
                        })
                        .then((messageInfo) => {
                            Logger.log(`Report mail ${messageInfo.messageId} sent to ${assigneeUser.email}`, DiscussionsService.name)
                        })
                        .catch((err) => {
                            Logger.error(`An error occurrend sending report mail to ${assigneeUser.email}`, err, DiscussionsService.name)
                        })

                    // To the author
                    let assignee = assigneeUser.display_name

                    this.mailerService
                        .sendMail({
                            to: isCentralized ? emailsCentralized : authorUser.email,
                            subject: `${assigneeUser.display_name} was assigned to the discussion ${discussion.title}`,
                            template: "discussion-author-new-assignee",
                            context: {
                                assignee,
                                organization,
                                team,
                                discussion,
                                frontendUrl,
                            },
                        })
                        .then((messageInfo) => {
                            Logger.log(`Report mail ${messageInfo.messageId} sent to ${authorUser.email}`, DiscussionsService.name)
                        })
                        .catch((err) => {
                            Logger.error(`An error occurrend sending report mail to ${authorUser.email}`, err, DiscussionsService.name)
                        })

                } // else { // Was already in the assignee list, nothing to do }

                processedAssignees.push(dbAssignee)
            }

            const removedAssignees = discussion.assignees.filter(x => processedAssignees.indexOf(x) === -1)

            if(removedAssignees) {
                // Notify to removed assignees and creator
                console.log(`Removed ${removedAssignees}`)
                
                for(const removed of removedAssignees) {
                    const removedUser: User = await this.usersService.getUserById(removed)
                    
                    // To the assignee
                    this.mailerService
                        .sendMail({
                            to: removedUser.email,
                            subject: `You were unassigned to the discussion ${discussion.title}`,
                            template: "discussion-you-were-removed-as-assignee",
                            context: {
                                organization,
                                team,
                                discussion,
                                frontendUrl,
                            },
                        })
                        .then((messageInfo) => {
                            Logger.log(`Report mail ${messageInfo.messageId} sent to ${removedUser.email}`, DiscussionsService.name)
                        })
                        .catch((err) => {
                            Logger.error(`An error occurrend sending report mail to ${removedUser.email}`, err, DiscussionsService.name)
                        })
        
                    // To the author
                    let assignee = removedUser.display_name
        
                    this.mailerService
                        .sendMail({
                            to: isCentralized ? emailsCentralized : authorUser.email,
                            subject: `${removedUser.display_name} was unassigned to the discussion ${discussion.title}`,
                            template: "discussion-author-removed-assignee",
                            context: {
                                assignee,
                                organization,
                                team,
                                discussion,
                                frontendUrl,
                            },
                        })
                        .then((messageInfo) => {
                            Logger.log(`Report mail ${messageInfo.messageId} sent to ${authorUser.email}`, DiscussionsService.name)
                        })
                        .catch((err) => {
                            Logger.error(`An error occurrend sending report mail to ${authorUser.email}`, err, DiscussionsService.name)
                        })
                }
            }
        } catch(ex) {
            Logger.error("Error sending notifications to new assignees in a discussion", ex)
        }

        return this.provider.update(
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
    }

    public async deleteDiscussion(id: string): Promise<Discussion> {
        const discussion: Discussion = await this.getDiscussion({ filter: { _id: this.provider.toObjectId(id) } })
        if (!discussion) {
            throw new PreconditionFailedException('Discussion not found')
        }
        if (discussion?.mark_delete_at) {
            throw new PreconditionFailedException('Discussion already deleted')
        }
        return this.provider.update(
            { _id: this.provider.toObjectId(discussion.id) },
            {
                $set: { mark_delete_at: new Date() },
            },
        )
    }
}
