import { FeedbackDto, NormalizedResponseDTO, Token } from '@kyso-io/kyso-model';
import { Body, Controller, ForbiddenException, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { FeedbackService } from './feedback.service';

@Controller('feedback')
@ApiTags('feedback')
@ApiBearerAuth()
@UseGuards(PermissionsGuard, EmailVerifiedGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @ApiOperation({ summary: 'Send feedback to service desk' })
  @ApiBody({
    description: 'Feedback message',
    required: true,
    type: FeedbackDto,
    examples: {
      json: {
        value: new FeedbackDto('Issue on the website', 'I cannot login to my account'),
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Feedback sent successfully',
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<boolean>(true),
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
        },
      },
    },
  })
  public async sendMessageToServiceDesk(@CurrentToken() token: Token, @Body() feedbackDto: FeedbackDto): Promise<NormalizedResponseDTO<boolean>> {
    const result: boolean = await this.feedbackService.sendMessageToServiceDesk(token, feedbackDto);
    return new NormalizedResponseDTO(result);
  }
}
