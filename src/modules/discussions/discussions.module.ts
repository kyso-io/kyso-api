import { KysoSetting, KysoSettingsEnum } from '@kyso-io/kyso-model';
import { DynamicModule } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { db } from '../../main';
import { DiscussionsController } from './discussions.controller';
import { createProvider, DiscussionsService } from './discussions.service';
import { DiscussionsMongoProvider } from './providers/discussions-mongo.provider';

export class DiscussionsModule {
  static forRoot(): DynamicModule {
    const dynamicProvider = createProvider();
    return {
      module: DiscussionsModule,
      providers: [DiscussionsService, DiscussionsMongoProvider, dynamicProvider],
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
      controllers: [DiscussionsController],
      exports: [dynamicProvider],
    };
  }
}
