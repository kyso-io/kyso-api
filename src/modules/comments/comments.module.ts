import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { CommentsMongoProvider } from './providers/mongo-comments.provider';

@Module({
  providers: [CommentsService, CommentsMongoProvider],
  controllers: [CommentsController],
  exports: [CommentsService],
})
export class CommentsModule {}
