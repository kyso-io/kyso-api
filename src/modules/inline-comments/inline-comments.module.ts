import { DynamicModule } from '@nestjs/common';
import { InlineCommentController } from './inline-comments.controller';
import { createProvider, InlineCommentsService } from './inline-comments.service';
import { MongoInlineCommentsProvider } from './providers/mongo-inline-comments.provider';

export class InlineCommentsModule {
  static forRoot(): DynamicModule {
    const dynamicProvider = createProvider();
    return {
      controllers: [InlineCommentController],
      exports: [dynamicProvider],
      module: InlineCommentsModule,
      providers: [dynamicProvider, InlineCommentsService, MongoInlineCommentsProvider],
    };
  }
}
