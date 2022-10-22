import { FeedbackDto, NormalizedResponseDTO, Token } from '@kyso-io/kyso-model';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
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
  @ApiNormalizedResponse({
    status: 201,
    description: 'Feedback sent successfully',
    type: Boolean,
    isArray: false,
  })
  public async sendMessageToServiceDesk(@CurrentToken() token: Token, @Body() feedbackDto: FeedbackDto): Promise<NormalizedResponseDTO<boolean>> {
    const result: boolean = await this.feedbackService.sendMessageToServiceDesk(token, feedbackDto);
    return new NormalizedResponseDTO(result);
  }
}
