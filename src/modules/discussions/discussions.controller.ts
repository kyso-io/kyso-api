import { Comment, CreateDiscussionRequestDTO, Discussion, NormalizedResponseDTO, UpdateDiscussionRequestDTO } from '@kyso-io/kyso-model'
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, PreconditionFailedException, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { InvalidInputError } from 'src/helpers/errorHandling'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Autowired } from '../../decorators/autowired'
import { GenericController } from '../../generic/controller.generic'
import { Permission } from '../auth/annotations/permission.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { CommentsService } from '../comments/comments.service'
import { RelationsService } from '../relations/relations.service'
import { DiscussionsService } from './discussions.service'
import { DiscussionPermissionsEnum } from './security/discussion-permissions.enum'

@ApiTags('discussions')
@ApiExtraModels(Discussion)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('discussions')
export class DiscussionsController extends GenericController<Discussion> {
    @Autowired({ typeName: 'CommentsService' })
    private readonly commentsService: CommentsService

    @Autowired({ typeName: 'RelationsService' })
    private relationsService: RelationsService

    constructor(private readonly discussionsService: DiscussionsService) {
        super()
    }

    @Get()
    @ApiOperation({ summary: 'Get all discussions' })
    @ApiNormalizedResponse({ status: 200, description: `Discussion`, type: Discussion, isArray: true })
    @Permission([DiscussionPermissionsEnum.READ])
    public async getDiscussions(
        @Query('team_id') teamId: string,
        @Query('user_id') userId: string,
        @Query('page', ParseIntPipe) page: number,
        @Query('per_page', ParseIntPipe) per_page: number,
        @Query('sort') sort: string,
        @Query('search') search: string,
    ): Promise<NormalizedResponseDTO<Discussion[]>> {
        const data: any = {
            filter: {
                mark_delete_at: { $eq: null },
            },
            sort: {
                created_at: -1,
            },
            limit: per_page,
            skip: (page - 1) * per_page,
        }
        if (teamId) {
            data.filter.team_id = teamId
        } else if (userId) {
            data.filter.user_id = userId
        }
        if (sort && (sort === 'asc' || sort === 'desc')) {
            data.sort.created_at = sort === 'asc' ? 1 : -1
        }
        if (search && search.length > 0) {
            data.filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { main: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ]
        }
        const discussions: Discussion[] = await this.discussionsService.getDiscussions(data)
        return new NormalizedResponseDTO(discussions)
    }

    @Get('/:discussionId')
    @ApiOperation({
        summary: 'Get discussion detail from specified id',
        description: 'Get discussion detail from specified id',
    })
    @ApiParam({
        name: 'discussionId',
        required: true,
        description: 'Id of the discussion to fetch',
        schema: { type: 'string' },
        example: 'K1bOzHjEmN',
    })
    @ApiNormalizedResponse({ status: 200, description: `Discussion`, type: Discussion })
    @Permission([DiscussionPermissionsEnum.READ])
    public async getDiscussionGivenTeamIdAndDiscussionNumber(@Param('discussionId') discussionId: string): Promise<NormalizedResponseDTO<Discussion>> {
        const discussion: Discussion = await this.discussionsService.getDiscussion({
            filter: { id: discussionId, mark_delete_at: { $eq: null } },
        })

        if (!discussion) {
            throw new PreconditionFailedException('Discussion not found')
        }

        return new NormalizedResponseDTO(discussion)
    }

    @Get('/:discussionId/comments')
    @ApiOperation({
        summary: `Get discussion's comments`,
        description: `Get discussion's comments`,
    })
    @ApiParam({
        name: 'discussionId',
        required: true,
        description: 'Id of the discussions comments to fetch',
        schema: { type: 'string' },
        example: 'K1bOzHjEmN',
    })
    @ApiNormalizedResponse({ status: 200, description: `Comments related to that discussion`, type: Comment, isArray: true })
    @Permission([DiscussionPermissionsEnum.READ])
    public async getDiscussionCommentsGivenTeamIdAndDiscussionNumber(@Param('discussionId') discussionId: string): Promise<NormalizedResponseDTO<Comment[]>> {
        const discussion: Discussion = await this.discussionsService.getDiscussion({
            id: discussionId,
        })

        if (!discussion) {
            throw new InvalidInputError('Discussion not found')
        }

        const comments: Comment[] = await this.commentsService.getComments({ filter: { discussion_id: discussionId } })
        const relations = await this.relationsService.getRelations(comments, 'comment')
        return new NormalizedResponseDTO(
            comments.filter((comment: Comment) => !comment.comment_id),
            relations,
        )
    }

    @Post()
    @ApiOperation({
        summary: 'Create discussion',
        description: 'Create discussion',
    })
    @Permission([DiscussionPermissionsEnum.CREATE])
    @ApiNormalizedResponse({ status: 201, description: `Discussion`, type: Discussion })
    public async createDiscussion(@Body() data: CreateDiscussionRequestDTO): Promise<NormalizedResponseDTO<Discussion>> {
        const updatedDiscussion: Discussion = await this.discussionsService.createDiscussion(data)
        return new NormalizedResponseDTO(updatedDiscussion)
    }

    @Patch('/:discussionId')
    @ApiOperation({
        summary: 'Update discussion',
        description: 'Update discussion',
    })
    @ApiParam({
        name: 'discussionId',
        required: true,
        description: 'Id of the discussion to update',
        schema: { type: 'string' },
        example: 'K1bOzHjEmN',
    })
    @Permission([DiscussionPermissionsEnum.EDIT])
    @ApiNormalizedResponse({ status: 200, description: `Discussion`, type: Discussion })
    public async updateDiscussion(
        @Param('discussionId') discussionId: string,
        @Body() data: UpdateDiscussionRequestDTO,
    ): Promise<NormalizedResponseDTO<Discussion>> {
        const updatedDiscussion: Discussion = await this.discussionsService.updateDiscussion(discussionId, data)
        return new NormalizedResponseDTO(updatedDiscussion)
    }

    @Delete('/:discussionId')
    @ApiOperation({
        summary: 'Delete discussion',
        description: 'Delete discussion',
    })
    @ApiParam({
        name: 'discussionId',
        required: true,
        description: 'Id of the discussion to delete',
        schema: { type: 'string' },
        example: 'K1bOzHjEmN',
    })
    @Permission([DiscussionPermissionsEnum.DELETE])
    @ApiNormalizedResponse({ status: 200, description: `Discussion`, type: Discussion })
    public async deleteDiscussion(@Param('discussionId') discussionId: string): Promise<NormalizedResponseDTO<Discussion>> {
        const deletedDiscussion: Discussion = await this.discussionsService.deleteDiscussion(discussionId)
        return new NormalizedResponseDTO(deletedDiscussion)
    }
}
