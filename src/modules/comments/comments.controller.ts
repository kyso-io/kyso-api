import { Comment, CommentDto, CommentPermissionsEnum, HEADER_X_KYSO_ORGANIZATION, HEADER_X_KYSO_TEAM, NormalizedResponseDTO, Token } from '@kyso-io/kyso-model';
import { Body, ConflictException, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, PreconditionFailedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
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
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('/:commentId')
  @ApiOperation({
    summary: `Get a comment`,
    description: `Allows fetching content of a specific comment passing its identificator`,
  })
  @ApiParam({
    name: 'commentId',
    required: true,
    description: 'Id of the comment to fetch',
    schema: { type: 'string' },
    example: 'K1bOzHjEmN',
  })
  @ApiResponse({
    status: 200,
    description: `Comment matching id`,
    content: {
      json: {
        examples: {
          comment: {
            value: new NormalizedResponseDTO<Comment>(Comment.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          noPermission: {
            value: new ForbiddenException('You do not have permission to access this comment'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          commentNotFound: {
            value: new NotFoundException(`Comment not found`),
          },
        },
      },
    },
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
  @ApiBody({
    description: 'New comment',
    required: true,
    examples: {
      newComment: {
        value: new CommentDto('Hi there!', 'Hi there!', '647f368421b67cfee313159f', null, null, false, ['647f367621b67cfee31314b6']),
      },
      replyComment: {
        value: new CommentDto('How are you!', 'How are you!', '647f368421b67cfee313159f', null, '647f368421b67cfee31315a2', false, []),
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: `New comment`,
    content: {
      json: {
        examples: {
          comment: {
            value: new NormalizedResponseDTO<Comment>(Comment.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
          noPermission: {
            value: new ForbiddenException('You do not have permission to create a comment'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          reportNotFound: {
            value: new NotFoundException(`Report not found`),
          },
          teamNotFound: {
            value: new NotFoundException(`Team not found`),
          },
        },
      },
    },
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
  @ApiParam({
    name: 'commentId',
    required: true,
    description: 'Id of the comment to fetch',
    schema: { type: 'string' },
    example: 'K1bOzHjEmN',
  })
  @ApiBody({
    description: 'Comment to update',
    required: true,
    type: CommentDto,
    examples: {
      json: {
        value: new CommentDto('Hi there!', 'Hi there!', '647f368421b67cfee313159f', null, null, false, ['647f367621b67cfee31314b6']),
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: `Updated comment`,
    content: {
      json: {
        examples: {
          comment: {
            value: new NormalizedResponseDTO<Comment>(Comment.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
          noPermission: {
            value: new ForbiddenException('You do not have permission to update this comment'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          commentNotFound: {
            value: new NotFoundException(`Comment not found`),
          },
          reportNotFound: {
            value: new NotFoundException(`Report not found`),
          },
          teamNotFound: {
            value: new NotFoundException(`Team not found`),
          },
          organizationNotFound: {
            value: new NotFoundException(`Organization not found`),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    content: {
      json: {
        examples: {
          commentDeleted: {
            value: new ConflictException(`Comment already deleted`),
          },
        },
      },
    },
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
  @ApiParam({
    name: 'commentId',
    required: true,
    description: 'Id of the comment to delete',
    schema: { type: 'string' },
    example: 'K1bOzHjEmN',
  })
  @ApiResponse({
    status: 200,
    description: `Deleted comment`,
    content: {
      json: {
        examples: {
          comment: {
            value: new NormalizedResponseDTO<Comment>(Comment.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
          noPermission: {
            value: new ForbiddenException('You do not have permission to delete this comment'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 412,
    content: {
      json: {
        examples: {
          reportDoesNotHaveTeam: {
            value: new PreconditionFailedException('Report does not have a team associated'),
          },
          commentDoesNotHaveReport: {
            value: new PreconditionFailedException('Comment does not have a report associated'),
          },
        },
      },
    },
  })
  @Permission([CommentPermissionsEnum.DELETE, CommentPermissionsEnum.DELETE_ONLY_MINE])
  async deleteComment(@CurrentToken() token: Token, @Param('commentId') commentId: string): Promise<NormalizedResponseDTO<Comment>> {
    const comment: Comment = await this.commentsService.deleteComment(token, commentId);
    return new NormalizedResponseDTO(comment);
  }
}
