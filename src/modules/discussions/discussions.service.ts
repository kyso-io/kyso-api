import { CreateDiscussionRequestDTO, Discussion, Team, UpdateDiscussionRequestDTO, User } from '@kyso-io/kyso-model'
import { Injectable, PreconditionFailedException, Provider } from '@nestjs/common'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { CommentsService } from '../comments/comments.service'
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

    @Autowired({ typeName: 'CommentsService' })
    private commentsService: CommentsService

    @Autowired({ typeName: 'TeamsService' })
    private teamsService: TeamsService

    constructor(private readonly provider: DiscussionsMongoProvider) {
        super()
    }

    public getDiscussions(query: any): Promise<Discussion[]> {
        return this.provider.read(query)
    }

    public async getDiscussion(query: any): Promise<Discussion> {
        const discussions: Discussion[] = await this.provider.read(query)
        return discussions.length > 0 ? discussions[0] : null
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

        const discussion: Discussion = new Discussion(
            data.answered,
            data.assignees,
            data.user_id,
            data.closed,
            data.description,
            data.discussion_number,
            data.main,
            author.nickname,
            data.participants,
            data.request_private,
            data.team_id,
            data.title,
            data.url_name,
        )
        return this.provider.create(discussion)
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
                    updated_at: new Date(),
                },
            },
        )
    }

    public async deleteDiscussion(id: string): Promise<Discussion> {
        const discussion: Discussion = await this.getDiscussion({ filer: { id: this.provider.toObjectId(id) } })
        if (!discussion) {
            throw new PreconditionFailedException('Discussion not found')
        }
        if (discussion?.mark_delete_at) {
            throw new PreconditionFailedException('Discussion already deleted')
        }
        return this.provider.update(
            { _id: this.provider.toObjectId(discussion.id) },
            {
                mark_delete_at: new Date(),
            },
        )
    }
}
