import { CreateDiscussionRequest, Discussion, NormalizedResponse, UpdateDiscussionRequest } from '@kyso-io/kyso-model'
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, PreconditionFailedException, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiTags } from '@nestjs/swagger'
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

    @Get('/team-discussions/:team_id')
    @ApiOperation({
        summary: 'Get all team discussions',
        description: 'Get all team discussions',
    })
    @ApiNormalizedResponse({ status: 200, description: `Discussion`, type: Discussion })
    @Permission([DiscussionPermissionsEnum.READ])
    public async getDiscussionsByTeam(@Param('team_id') team_id: string): Promise<NormalizedResponse<Discussion[]>> {
        const discussions: Discussion[] = await this.discussionsService.getDiscussions({ filter: { team_id, mark_delete_at: { $ne: null } } })
        return new NormalizedResponse(discussions)
    }

    @Get('/:team_id/:discussion_number')
    @ApiOperation({
        summary: 'Get discussion given team_id and discussion_number',
        description: 'Get discussion given team_id and discussion_number',
    })
    @ApiNormalizedResponse({ status: 200, description: `Discussion`, type: Discussion })
    @Permission([DiscussionPermissionsEnum.READ])
    public async getDiscussionGivenTeamIdAndDiscussionNumber(
        @Param('team_id') team_id: string,
        @Param('discussion_number', ParseIntPipe) discussion_number: number,
    ): Promise<NormalizedResponse<Discussion>> {
        const discussion: Discussion = await this.discussionsService.getDiscussion({ filter: { team_id, discussion_number, mark_delete_at: { $ne: null } } })
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

    @Patch(':id')
    @ApiOperation({
        summary: 'Update discussion',
        description: 'Update discussion',
    })
    @Permission([DiscussionPermissionsEnum.EDIT])
    @ApiNormalizedResponse({ status: 200, description: `Discussion`, type: Discussion })
    public async updateDiscussion(@Param('id') id: string, @Body() updateDiscussionRequest: UpdateDiscussionRequest): Promise<NormalizedResponse<Discussion>> {
        const updatedDiscussion: Discussion = await this.discussionsService.updateDiscussion(id, updateDiscussionRequest)
        return new NormalizedResponse(updatedDiscussion)
    }

    @Delete(':id')
    @ApiOperation({
        summary: 'Delete discussion',
        description: 'Delete discussion',
    })
    @Permission([DiscussionPermissionsEnum.DELETE])
    @ApiNormalizedResponse({ status: 200, description: `Discussion`, type: Discussion })
    public async deleteDiscussion(@Param('id') id: string): Promise<NormalizedResponse<Discussion>> {
        const deletedDiscussion: Discussion = await this.discussionsService.deleteDiscussion(id)
        return new NormalizedResponse(deletedDiscussion)
    }
}
