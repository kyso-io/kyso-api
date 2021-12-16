import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiHeader, ApiHeaders, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Comment } from 'src/model/comment.model'
import { GenericController } from 'src/generic/controller.generic'
import { HateoasLinker } from 'src/helpers/hateoasLinker'
import { CommentsService } from 'src/modules/comments/comments.service'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { Permission } from '../auth/annotations/permission.decorator'
import { CommentPermissionsEnum } from './security/comment-permissions.enum'

@ApiTags('comments')
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('comments')
export class CommentsController extends GenericController<Comment> {
    constructor(private readonly commentsService: CommentsService) {
        super()
    }

    assignReferences(comment: Comment) {
        comment.self_url = HateoasLinker.createRef(`/comment/${comment.id}`)

        // Recursive!!
        // comment.comments.forEach((x) => {
        //     this.assignReferences(x)
        // })
    }

    @Get('/:commentId')
    @ApiOperation({
        summary: `Get a comment`,
        description: `Allows fetching content of a specific comment passing its identificator`,
    })
    @ApiResponse({
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

        this.assignReferences(comment)

        return comment
    }
}
