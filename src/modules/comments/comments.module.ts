import { DynamicModule } from '@nestjs/common';
import { registerNatsService } from '../../providers/nats-service-register';
import { BaseCommentsService, createBaseCommentsProvider } from './base-comments.service';
import { CommentsController } from './comments.controller';
import { CommentsService, createProvider } from './comments.service';
import { CommentsMongoProvider } from './providers/mongo-comments.provider';

export class CommentsModule {
  static forRoot(): DynamicModule {
    const dynamicProvider = createProvider();
    const baseCommentDynamicProvider = createBaseCommentsProvider();

    return {
      module: CommentsModule,
      providers: [CommentsMongoProvider, CommentsService, BaseCommentsService, dynamicProvider, baseCommentDynamicProvider],
      imports: [registerNatsService()],
      exports: [dynamicProvider, baseCommentDynamicProvider],
      controllers: [CommentsController],
    };
  }
}
