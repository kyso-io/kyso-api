import { CreateDiscussionRequestDTO, Discussion, Organization, Team, UpdateDiscussionRequestDTO, User } from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Injectable, Logger, PreconditionFailedException, Provider } from '@nestjs/common'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { KysoSettingsEnum } from '../kyso-settings/enums/kyso-settings.enum'
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
export class DiscussionsService extends AutowiredService {
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
                subject: `New discussion on ${team.display_name}`,
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
        if (!discussion) {
            throw new PreconditionFailedException('Discussion not found')
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
