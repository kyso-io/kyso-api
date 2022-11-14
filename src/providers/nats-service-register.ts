import { KysoSetting, KysoSettingsEnum } from '@kyso-io/kyso-model';
import { DynamicModule } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { db } from '../main';

export const registerNatsService = (): DynamicModule => {
  return ClientsModule.registerAsync([
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
  ]);
};
