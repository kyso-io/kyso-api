import { DynamicModule } from '@nestjs/common'
import { InvitationsController } from './invitations.controller'
import { createProvider, InvitationsService } from './invitations.service'
import { InvitationsMongoProvider } from './providers/Invitations-mongo.provider'

export class InvitationsModule {
    static forRoot(): DynamicModule {
        const dynamicProvider = createProvider()
        return {
            module: InvitationsModule,
            providers: [dynamicProvider, InvitationsMongoProvider, InvitationsService],
            controllers: [InvitationsController],
            exports: [dynamicProvider],
        }
    }
}
