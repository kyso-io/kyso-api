import { CreateDiscussionRequest, Discussion, Team, UpdateDiscussionRequest, User } from '@kyso-io/kyso-model'
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

    public async createDiscussion(createDiscussionRequest: CreateDiscussionRequest): Promise<Discussion> {
        const author: User = await this.usersService.getUserById(createDiscussionRequest.user_id)
        if (!author) {
            throw new PreconditionFailedException('Author not found')
        }

        for (const participan_id of createDiscussionRequest.participants) {
            const participant: User = await this.usersService.getUserById(participan_id)
            if (!participant) {
                throw new PreconditionFailedException('Participant not found')
            }
        }

        const team: Team = await this.teamsService.getTeamById(createDiscussionRequest.team_id)
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }

        const discussion: Discussion = new Discussion(
            createDiscussionRequest.answered,
            createDiscussionRequest.assignees,
            createDiscussionRequest.user_id,
            createDiscussionRequest.closed,
            createDiscussionRequest.description,
            createDiscussionRequest.discussion_number,
            createDiscussionRequest.main,
            author.nickname,
            createDiscussionRequest.participants,
            createDiscussionRequest.request_private,
            createDiscussionRequest.team_id,
            createDiscussionRequest.title,
            createDiscussionRequest.url_name,
        )
        return this.provider.create(discussion)
    }

    public async updateDiscussion(id: string, updateDiscussionRequest: UpdateDiscussionRequest): Promise<Discussion> {
        const discussion: Discussion = await this.getDiscussion({ filer: { id: this.provider.toObjectId(id), mark_delete_at: { $ne: null } } })
        if (!discussion) {
            throw new PreconditionFailedException('Discussion not found')
        }
        return this.provider.update(
            { _id: this.provider.toObjectId(discussion.id) },
            {
                $set: {
                    answered: updateDiscussionRequest.answered,
                    assignees: updateDiscussionRequest.assignees,
                    closed: updateDiscussionRequest.closed,
                    description: updateDiscussionRequest.description,
                    discussion_number: updateDiscussionRequest.discussion_number,
                    edited: true,
                    main: updateDiscussionRequest.main,
                    participants: updateDiscussionRequest.participants,
                    request_private: updateDiscussionRequest.request_private,
                    title: updateDiscussionRequest.title,
                    url_name: updateDiscussionRequest.url_name,
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
