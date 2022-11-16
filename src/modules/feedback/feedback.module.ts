import { Module } from '@nestjs/common';
import { registerNatsService } from '../../providers/nats-service-register';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

@Module({
  controllers: [FeedbackController],
  providers: [FeedbackService],
  imports: [registerNatsService()],
})
export class FeedbackModule {}
