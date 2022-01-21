import { CreateDiscussionRequestDTO, Discussion, NormalizedResponseDTO, UpdateDiscussionRequestDTO, Comment } from '@kyso-io/kyso-model'
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, PreconditionFailedException, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { GenericController } from '../../generic/controller.generic'
import { Permission } from '../auth/annotations/permission.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { DiscussionsService } from './discussions.service'
import { DiscussionPermissionsEnum } from './security/discussion-permissions.enum'

@ApiTags('discussions')
@ApiExtraModels(Discussion)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('discussions')
export class DiscussionsController extends GenericController<Discussion> {
    constructor(private readonly discussionsService: DiscussionsService) {
        super()
    }

    @Get()
    @ApiOperation({ summary: 'Get all discussions' })
    @ApiNormalizedResponse({ status: 200, description: `Discussion`, type: Discussion, isArray: true })
    @Permission(DiscussionPermissionsEnum.READ)
    public async getDiscussions(
        @Query('teamId') teamId: string,
        @Query('userId') userId: string,
        @Query('page', ParseIntPipe) page: number,
        @Query('per_page', ParseIntPipe) per_page: number,
        @Query('sort') sort: string,
    ): Promise<NormalizedResponseDTO<Discussion[]>> {
        const data: any = {
            filter: {
                mark_delete_at: { $ne: null },
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
        const discussions: Discussion[] = await this.discussionsService.getDiscussions(data)
        return new NormalizedResponseDTO(discussions)
    }

    @Get('/:teamId/:discussionNumber')
    @ApiOperation({
        summary: 'Get discussion given id of the team and discussion number',
        description: 'Get discussion given id of the team and discussion number',
    })
    @ApiParam({
        name: 'teamId',
        required: true,
        description: 'Id of the team to fetch the discussions',
        schema: { type: 'string' },
        example: 'K1bOzHjEmN',
    })
    @ApiParam({
        name: 'discussionNumber',
        required: true,
        description: 'Discussion number of the discussion',
        schema: { type: 'number' },
        example: '1',
    })
    @ApiNormalizedResponse({ status: 200, description: `Discussion`, type: Discussion })
    @Permission([DiscussionPermissionsEnum.READ])
    public async getDiscussionGivenTeamIdAndDiscussionNumber(
        @Param('teamId') teamId: string,
        @Param('discussionNumber', ParseIntPipe) discussionNumber: number,
    ): Promise<NormalizedResponseDTO<Discussion>> {
        const discussion: Discussion = await this.discussionsService.getDiscussion({
            filter: { team_id: teamId, discussion_number: discussionNumber, mark_delete_at: { $ne: null } },
        })
        if (!discussion) {
            throw new PreconditionFailedException('Discussion not found')
        }
        return new NormalizedResponseDTO(discussion)
    }

    @Get('/:teamId/:discussionNumber/comments')
    @ApiOperation({
        summary: `Get discussion's comments given id of the team and discussion number`,
        description: `Get discussion given id of the team and discussion number`,
    })
    @ApiParam({
        name: 'teamId',
        required: true,
        description: 'Id of the team to fetch the discussions',
        schema: { type: 'string' },
        example: 'K1bOzHjEmN',
    })
    @ApiParam({
        name: 'discussionNumber',
        required: true,
        description: 'Discussion number of the discussion',
        schema: { type: 'number' },
        example: '1',
    })
    @ApiNormalizedResponse({ status: 200, description: `Comments related to that discussion`, type: Comment, isArray: true })
    @Permission([DiscussionPermissionsEnum.READ])
    public async getDiscussionCommentsGivenTeamIdAndDiscussionNumber(
        @Param('teamId') teamId: string,
        @Param('discussionNumber', ParseIntPipe) discussionNumber: number,
    ): Promise<NormalizedResponseDTO<Comment[]>> {
        // TODO: THIS IS A FAKE RESPONSE
        const fakeComments: Comment[] = []
        
        let comment1 = new Comment(
            "So I got J&J as my first vaccine and two months later got a Moderna booster. Six months have passed and I wonder whether I should get an additional dose or not and if this should be Moderna or something else.",
            "61a8ae8f9c2bc3c5a2144000",
            "61ea82cb2e832f8e0ff9f0c5",
            "61ea82c6ca89be622f1abd89"
        )

        let comment2 = new Comment(
            "The vaccination you got was in retrospect a good idea, but it sounds like you did it through some unofficial/off-label channel (or were you in some trial?), because 1) 6 months ago there was no approved booster and 2) what you got was not the Moderna booster but rather the beginning of the 2-dose series. What the FDA approved and calls a Moderna booster is the 1/2 dose (50ug) shot. You probably just told them you were signing up to get the vaccine and hadn't gotten the J&J?",
            "61a8ae8f9c2bc3c5a2144000",
            "61ea82cb2e832f8e0ff9f0c5",
            "61ea82c6ca89be622f1abd89"
        )

        fakeComments.push(comment1)
        fakeComments.push(comment2)

        return new NormalizedResponseDTO(fakeComments)
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
