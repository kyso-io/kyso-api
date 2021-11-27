import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Comment } from 'src/model/comment.model';
import { GenericController } from 'src/generic/controller.generic';
import { HateoasLinker } from 'src/helpers/hateoasLinker';
import { CommentsService } from 'src/modules/comments/comments.service';

@ApiTags('comments')
@Controller('comments')
export class CommentsController extends GenericController<Comment> {
    constructor(private readonly commentsService: CommentsService) {
        super();
    }

    assignReferences(comment: Comment) {
        comment.self_url = HateoasLinker.createRef(`/comment/${comment.id}`)
        
        // Recursive!!
        comment.child_comments.forEach( x => {
            this.assignReferences(x);
        })
    }

    @Get('/:commentId')
    @ApiOperation({
        summary: `Get a comment`,
        description: `Allows fetching content of a specific comment passing its identificator`
    })
    @ApiResponse({ status: 200, description: `Comment matching id`, type: Comment})
    @ApiParam({name: 'commentId', required: true, description: 'Id of the comment to fetch', schema: { type: "string"}, example: "K1bOzHjEmN" })
    async getComment(@Param('commentId') commentId: string) {
        const comment = await this.commentsService.getCommentWithChildren(commentId)

        this.assignReferences(comment)

        return comment;
    }
}
