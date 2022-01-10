import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { Permission } from '../auth/annotations/permission.decorator'
import { CommentPermissionsEnum } from './security/comment-permissions.enum'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { NormalizedResponse } from '../../model/dto/normalized-reponse.dto'
import { GenericController } from '../../generic/controller.generic'
import { CommentsService } from './comments.service'
import { Comment } from '../../model/comment.model'

@ApiTags('comments')
@ApiExtraModels(Comment)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('comments')
export class CommentsController extends GenericController<Comment> {
    constructor(private readonly commentsService: CommentsService) {
        super()
    }

    assignReferences(comment) {}

    @Get('/:commentId')
    @ApiOperation({
        summary: `Get a comment`,
        description: `Allows fetching content of a specific comment passing its identificator`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Comment matching id`,
        type: Comment,
    })
    @ApiParam({
        name: 'commentId',
        required: true,
        description: 'Id of the comment to fetch',
        schema: { type: 'string' },
        example: 'K1bOzHjEmN',
    })
    @Permission([CommentPermissionsEnum.READ])
    async getComment(@Param('commentId') commentId: string) {
        const comment = await this.commentsService.getCommentWithChildren(commentId)
        return new NormalizedResponse(comment)
    }
}
