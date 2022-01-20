import { Comment, NormalizedResponse, Token } from '@kyso-io/kyso-model'
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { GenericController } from '../../generic/controller.generic'
import { GlobalPermissionsEnum } from '../../security/general-permissions.enum'
import { CurrentToken } from '../auth/annotations/current-token.decorator'
import { Permission } from '../auth/annotations/permission.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { CommentsService } from './comments.service'
import { CommentPermissionsEnum } from './security/comment-permissions.enum'

@ApiTags('comments')
@ApiExtraModels(Comment)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('comments')
export class CommentsController extends GenericController<Comment> {
    constructor(private readonly commentsService: CommentsService) {
        super()
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    assignReferences(comment: Comment) {}

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
    async getComment(@Param('commentId') commentId: string): Promise<NormalizedResponse<Comment>> {
        const comment: Comment = await this.commentsService.getCommentWithChildren(commentId)
        return new NormalizedResponse(comment)
    }

    @Post()
    @ApiOperation({
        summary: `Create a comment`,
        description: `Allows creating a new comment`,
    })
    @ApiNormalizedResponse({
        status: 201,
        description: `Comment created`,
        type: Comment,
    })
    @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN, CommentPermissionsEnum.ADMIN, CommentPermissionsEnum.CREATE])
    public async createComment(@CurrentToken() token: Token, @Body() comment: Comment): Promise<NormalizedResponse<Comment>> {
        const newComment: Comment = await this.commentsService.createCommentGivenToken(token, comment)
        return new NormalizedResponse(newComment)
    }

    @Patch('/:commentId')
    @ApiOperation({
        summary: `Update a comment`,
        description: `Allows updating a comment`,
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
    @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN, CommentPermissionsEnum.ADMIN, CommentPermissionsEnum.EDIT])
    public async updateComment(
        @CurrentToken() token: Token,
        @Param('commentId') commentId: string,
        @Body() comment: Comment,
    ): Promise<NormalizedResponse<Comment>> {
        const updatedComment: Comment = await this.commentsService.updateComment(token, commentId, comment)
        return new NormalizedResponse(updatedComment)
    }

    @Delete('/:commentId')
    @ApiOperation({
        summary: `Delete a comment`,
        description: `Allows deleting a comment passing its identificator`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Comment deleted`,
        type: Boolean,
    })
    @ApiParam({
        name: 'commentId',
        required: true,
        description: 'Id of the comment to delete',
        schema: { type: 'string' },
        example: 'K1bOzHjEmN',
    })
    @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN, CommentPermissionsEnum.ADMIN, CommentPermissionsEnum.DELETE])
    async deleteComment(@CurrentToken() token: Token, @Param('commentId') commentId: string): Promise<NormalizedResponse<boolean>> {
        const result: boolean = await this.commentsService.deleteComment(token, commentId)
        return new NormalizedResponse(result)
    }
}
