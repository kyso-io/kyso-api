import { CommentDto, Comment, CommentPermissionsEnum, HEADER_X_KYSO_ORGANIZATION, HEADER_X_KYSO_TEAM, NormalizedResponseDTO, Token } from '@kyso-io/kyso-model';
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
import { GenericController } from '../../generic/controller.generic';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { Permission } from '../auth/annotations/permission.decorator';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { SolvedCaptchaGuard } from '../auth/guards/solved-captcha.guard';
import { CommentsService } from './comments.service';

@ApiTags('comments')
@ApiExtraModels(Comment)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('comments')
@ApiHeader({
  name: HEADER_X_KYSO_ORGANIZATION,
  description: 'active organization (i.e: lightside)',
  required: true,
})
@ApiHeader({
  name: HEADER_X_KYSO_TEAM,
  description: 'active team (i.e: protected-team)',
  required: true,
})
export class CommentsController extends GenericController<Comment> {
  constructor(private readonly commentsService: CommentsService) {
    super();
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
  async getComment(@Param('commentId') commentId: string): Promise<NormalizedResponseDTO<Comment>> {
    const comment: Comment = await this.commentsService.getCommentWithChildren(commentId);
    return new NormalizedResponseDTO(comment);
  }

  @Post()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Create a comment`,
    description: `Allows creating a new comment`,
  })
  @ApiNormalizedResponse({
    status: 201,
    description: `Comment created`,
    type: Comment,
  })
  @Permission([CommentPermissionsEnum.CREATE])
  public async createComment(@CurrentToken() token: Token, @Body() createCommentDto: CommentDto): Promise<NormalizedResponseDTO<Comment>> {
    const newComment: Comment = await this.commentsService.createCommentGivenToken(token, createCommentDto);
    return new NormalizedResponseDTO(newComment);
  }

  @Patch('/:commentId')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
  @Permission([CommentPermissionsEnum.EDIT])
  public async updateComment(@CurrentToken() token: Token, @Param('commentId') commentId: string, @Body() updateCommentDto: CommentDto): Promise<NormalizedResponseDTO<Comment>> {
    const updatedComment: Comment = await this.commentsService.updateComment(token, commentId, updateCommentDto);
    return new NormalizedResponseDTO(updatedComment);
  }

  @Delete('/:commentId')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Delete a comment`,
    description: `Allows deleting a comment passing its identificator`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Comment deleted`,
    type: Comment,
  })
  @ApiParam({
    name: 'commentId',
    required: true,
    description: 'Id of the comment to delete',
    schema: { type: 'string' },
    example: 'K1bOzHjEmN',
  })
  @Permission([CommentPermissionsEnum.DELETE, CommentPermissionsEnum.DELETE_ONLY_MINE])
  async deleteComment(@CurrentToken() token: Token, @Param('commentId') commentId: string): Promise<NormalizedResponseDTO<Comment>> {
    const comment: Comment = await this.commentsService.deleteComment(token, commentId);
    return new NormalizedResponseDTO(comment);
  }
}
