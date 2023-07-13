import { DynamicModule } from '@nestjs/common';
import { registerNatsService } from '../../providers/nats-service-register';
import { createProvider, InvitationsService } from './invitations.service';
import { InvitationsMongoProvider } from './providers/invitations-mongo.provider';

export class InvitationsModule {
  static forRoot(): DynamicModule {
    const dynamicProvider = createProvider();
    return {
      module: InvitationsModule,
      providers: [dynamicProvider, InvitationsMongoProvider, InvitationsService],
      // controllers: [InvitationsController],
      exports: [dynamicProvider],
      imports: [registerNatsService()],
    };
  }
}
