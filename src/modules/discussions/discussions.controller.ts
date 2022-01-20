import { CreateDiscussionRequest, Discussion, NormalizedResponse, UpdateDiscussionRequest } from '@kyso-io/kyso-model'
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, PreconditionFailedException, UseGuards } from '@nestjs/common'
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

    @Get('/team-discussions/:teamId')
    @ApiOperation({
        summary: 'Get all team discussions',
        description: 'Get all team discussions',
    })
    @ApiNormalizedResponse({ status: 200, description: `Discussion`, type: Discussion })
    @ApiParam({
        name: 'teamId',
        required: true,
        description: 'Id of the team to fetch the discussions',
        schema: { type: 'string' },
        example: 'K1bOzHjEmN',
    })
    @Permission([DiscussionPermissionsEnum.READ])
    public async getDiscussionsByTeam(@Param('teamId') teamId: string): Promise<NormalizedResponse<Discussion[]>> {
        const discussions: Discussion[] = await this.discussionsService.getDiscussions({ filter: { team_id: teamId, mark_delete_at: { $ne: null } } })
        return new NormalizedResponse(discussions)
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
    ): Promise<NormalizedResponse<Discussion>> {
        const discussion: Discussion = await this.discussionsService.getDiscussion({
            filter: { team_id: teamId, discussion_number: discussionNumber, mark_delete_at: { $ne: null } },
        })
        if (!discussion) {
            throw new PreconditionFailedException('Discussion not found')
        }
        return new NormalizedResponse(discussion)
    }

    @Post()
    @ApiOperation({
        summary: 'Create discussion',
        description: 'Create discussion',
    })
    @Permission([DiscussionPermissionsEnum.CREATE])
    @ApiNormalizedResponse({ status: 201, description: `Discussion`, type: Discussion })
    public async createDiscussion(@Body() createDiscussionRequest: CreateDiscussionRequest): Promise<NormalizedResponse<Discussion>> {
        const updatedDiscussion: Discussion = await this.discussionsService.createDiscussion(createDiscussionRequest)
        return new NormalizedResponse(updatedDiscussion)
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
        @Body() updateDiscussionRequest: UpdateDiscussionRequest,
    ): Promise<NormalizedResponse<Discussion>> {
        const updatedDiscussion: Discussion = await this.discussionsService.updateDiscussion(discussionId, updateDiscussionRequest)
        return new NormalizedResponse(updatedDiscussion)
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
    public async deleteDiscussion(@Param('discussionId') discussionId: string): Promise<NormalizedResponse<Discussion>> {
        const deletedDiscussion: Discussion = await this.discussionsService.deleteDiscussion(discussionId)
        return new NormalizedResponse(deletedDiscussion)
    }
}
