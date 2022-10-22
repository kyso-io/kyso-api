import { KysoSetting, KysoSettingsEnum } from '@kyso-io/kyso-model';
import { DynamicModule } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { db } from '../../main';
import { InvitationsController } from './invitations.controller';
import { createProvider, InvitationsService } from './invitations.service';
import { InvitationsMongoProvider } from './providers/invitations-mongo.provider';

export class InvitationsModule {
  static forRoot(): DynamicModule {
    const dynamicProvider = createProvider();
    return {
      module: InvitationsModule,
      providers: [dynamicProvider, InvitationsMongoProvider, InvitationsService],
      controllers: [InvitationsController],
      exports: [dynamicProvider],
      imports: [
        ClientsModule.registerAsync([
          {
            name: 'NATS_SERVICE',
            useFactory: async () => {
              const kysoSettingCollection = db.collection('KysoSettings');
              const server: KysoSetting[] = await kysoSettingCollection.find({ key: KysoSettingsEnum.KYSO_NATS_URL }).toArray();
              return {
                name: 'NATS_SERVICE',
                transport: Transport.NATS,
                options: {
                  servers: server[0] ? [server[0].value] : [],
                },
              };
            },
          },
        ]),
      ],
    };
  }
}
