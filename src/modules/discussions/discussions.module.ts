import { DynamicModule } from '@nestjs/common';
import { registerNatsService } from '../../providers/nats-service-register';
import { createProvider, DiscussionsService } from './discussions.service';
import { DiscussionsMongoProvider } from './providers/discussions-mongo.provider';

export class DiscussionsModule {
  static forRoot(): DynamicModule {
    const dynamicProvider = createProvider();
    return {
      module: DiscussionsModule,
      providers: [DiscussionsService, DiscussionsMongoProvider, dynamicProvider],
      imports: [registerNatsService()],
      // controllers: [DiscussionsController],
      exports: [dynamicProvider],
    };
  }
}
