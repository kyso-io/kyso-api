import { DynamicModule } from '@nestjs/common';
import { RequestAccessMongoProvider } from './providers/request-access.provider';
import { createProvider, RequestAccessService } from './request-access.service';

/**
 * This module is shared by Organizations and Teams, for that reason is decoupled and is not inside
 * any of both. Has no controllers, because the controllers that manage this are inside organizations
 * and teams.
 */
export class RequestAccessModule {
  static forRoot(): DynamicModule {
    const dynamicProvider = createProvider();
    return {
      module: RequestAccessModule,
      providers: [RequestAccessService, RequestAccessMongoProvider, dynamicProvider],
      controllers: [],
      exports: [dynamicProvider],
    };
  }
}
