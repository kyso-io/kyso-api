import {
    Comment,
    CreateDiscussionRequestDTO,
    Discussion,
    DiscussionPermissionsEnum,
    NormalizedResponseDTO,
    UpdateDiscussionRequestDTO,
} from '@kyso-io/kyso-model'
import { Body, Controller, Delete, Get, Param, Patch, Post, PreconditionFailedException, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { InvalidInputError } from '../../helpers/errorHandling'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Autowired } from '../../decorators/autowired'
import { GenericController } from '../../generic/controller.generic'
import { QueryParser } from '../../helpers/queryParser'
import { Permission } from '../auth/annotations/permission.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { CommentsService } from '../comments/comments.service'
import { RelationsService } from '../relations/relations.service'
import { DiscussionsService } from './discussions.service'
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard'

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
    public async getDiscussions(@Req() req): Promise<NormalizedResponseDTO<Discussion[]>> {
        const query = QueryParser.toQueryObject(req.url)
        if (!query.sort) {
            query.sort = { created_at: -1 }
        }
        query.filter.mark_delete_at = { $eq: null }
        if (query?.filter?.$text) {
            query.filter.$or = [
                { title: { $regex: `${query.filter.$text.$search}`, $options: 'i' } },
                { main: { $regex: `${query.filter.$text.$search}`, $options: 'i' } },
                { description: { $regex: `${query.filter.$text.$search}`, $options: 'i' } },
            ]
            delete query.$text
        }
        const discussions: Discussion[] = await this.discussionsService.getDiscussions(query)
        const relations = await this.relationsService.getRelations(discussions, 'discussion', { participants: 'User', assignees: 'User' })
        return new NormalizedResponseDTO(discussions, relations)
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

        const relations = await this.relationsService.getRelations(discussion, 'discussion', { participants: 'User', assignees: 'User' })
        return new NormalizedResponseDTO(discussion, relations)
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
    public async getDiscussionCommentsGivenTeamIdAndDiscussionNumber(
        @Param('discussionId') discussionId: string,
        @Req() req,
    ): Promise<NormalizedResponseDTO<Comment[]>> {
        const discussion: Discussion = await this.discussionsService.getDiscussion({
            id: discussionId,
        })
        if (!discussion) {
            throw new InvalidInputError('Discussion not found')
        }
        const query = QueryParser.toQueryObject(req.url)
        if (!query.sort) {
            query.sort = { created_at: -1 }
        }
        const comments: Comment[] = await this.commentsService.getComments({ filter: { discussion_id: discussionId }, sort: query.sort })
        const relations = await this.relationsService.getRelations(comments, 'comment')
        return new NormalizedResponseDTO(
            comments.filter((comment: Comment) => !comment.comment_id),
            relations,
        )
    }

    @Post()
    @UseGuards(EmailVerifiedGuard)
    @ApiOperation({
        summary: 'Create discussion',
        description: 'Create discussion',
    })
    @Permission([DiscussionPermissionsEnum.CREATE])
    @ApiNormalizedResponse({ status: 201, description: `Discussion`, type: Discussion })
    public async createDiscussion(@Body() data: CreateDiscussionRequestDTO): Promise<NormalizedResponseDTO<Discussion>> {
        const updatedDiscussion: Discussion = await this.discussionsService.createDiscussion(data)
        const relations = await this.relationsService.getRelations(updatedDiscussion, 'discussion', { participants: 'User', assignees: 'User' })
        return new NormalizedResponseDTO(updatedDiscussion, relations)
    }

    @Patch('/:discussionId')
    @UseGuards(EmailVerifiedGuard)
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
        const relations = await this.relationsService.getRelations(updatedDiscussion, 'discussion', { participants: 'User', assignees: 'User' })
        return new NormalizedResponseDTO(updatedDiscussion, relations)
    }

    @Delete('/:discussionId')
    @UseGuards(EmailVerifiedGuard)
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
