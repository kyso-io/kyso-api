import { CreateInlineCommentDto, InlineComment, InlineCommentDto, Report, Team, UpdateInlineCommentDto, User } from '@kyso-io/kyso-model'
import { ForbiddenException, Injectable, NotFoundException, Provider } from '@nestjs/common'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { ReportsService } from '../reports/reports.service'
import { TeamsService } from '../teams/teams.service'
import { UsersService } from '../users/users.service'
import { MongoInlineCommentsProvider } from './providers/mongo-inline-comments.provider'

function factory(service: InlineCommentsService) {
    return service
}

export function createProvider(): Provider<InlineCommentsService> {
    return {
        provide: `${InlineCommentsService.name}`,
        useFactory: (service) => factory(service),
        inject: [InlineCommentsService],
    }
}

@Injectable()
export class InlineCommentsService extends AutowiredService {
    @Autowired({ typeName: 'ReportsService' })
    private reportsService: ReportsService

    @Autowired({ typeName: 'TeamsService' })
    private teamsService: TeamsService

    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    constructor(private readonly provider: MongoInlineCommentsProvider) {
        super()
    }

    private async getById(id: string): Promise<InlineComment> {
        const inlineComments: InlineComment[] = await this.provider.read({ filter: { _id: this.provider.toObjectId(id) } })
        return inlineComments.length === 1 ? inlineComments[0] : null
    }

    public async getGivenReportId(report_id: string): Promise<InlineComment[]> {
        return this.provider.read({ filter: { report_id }, sort: { created_at: 1 } })
    }

    public async createInlineComment(userId: string, createInlineCommentDto: CreateInlineCommentDto): Promise<InlineComment> {
        const report: Report = await this.reportsService.getReportById(createInlineCommentDto.report_id)
        if (!report) {
            throw new NotFoundException(`Report with id ${createInlineCommentDto.report_id} not found`)
        }
        const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(userId)
        const team: Team = teams.find((team) => team.id === report.team_id)
        if (!team) {
            throw new ForbiddenException(`User with id ${userId} is not allowed to create inline comments for report ${report.sluglified_name}`)
        }
        const inlineComment: InlineComment = new InlineComment(
            report.id, 
            createInlineCommentDto.cell_id, 
            userId, 
            createInlineCommentDto.text,
            false, 
            false,
            createInlineCommentDto.mentions
        )
        
        return this.provider.create(inlineComment)
    }

    public async updateInlineComment(userId: string, id: string, updateInlineCommentDto: UpdateInlineCommentDto): Promise<InlineComment> {
        const inlineComment: InlineComment = await this.getById(id)
        if (!inlineComment) {
            throw new NotFoundException(`Inline comment with id ${id} not found`)
        }
        if (inlineComment.user_id !== userId) {
            throw new ForbiddenException(`User with id ${userId} is not allowed to update inline comment ${id}`)
        }
        return this.provider.update({ _id: this.provider.toObjectId(inlineComment.id) }, { $set: { edited: true, text: updateInlineCommentDto.text } })
    }

    public async deleteInlineComment(userId: string, id: string): Promise<boolean> {
        const inlineComment: InlineComment = await this.getById(id)
        if (!inlineComment) {
            throw new NotFoundException(`Inline comment with id ${id} not found`)
        }
        if (inlineComment.user_id !== userId) {
            throw new ForbiddenException(`User with id ${userId} is not allowed to delete this inline comment`)
        }
        await this.provider.deleteOne({ _id: this.provider.toObjectId(id) })
        return true
    }

    public async inlineCommentModelToInlineCommentDto(inlineComment: InlineComment): Promise<InlineCommentDto> {
        const user: User = await this.usersService.getUserById(inlineComment.user_id)
        return new InlineCommentDto(
            inlineComment.id,
            inlineComment.created_at,
            inlineComment.updated_at,
            inlineComment.report_id,
            inlineComment.cell_id,
            inlineComment.user_id,
            inlineComment.text,
            inlineComment.edited,
            inlineComment.markedAsDeleted,
            user.name,
            user.avatar_url,
            inlineComment.mentions
        )
    }
}
