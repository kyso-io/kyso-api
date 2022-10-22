import { KysoSetting, KysoSettingsEnum } from '@kyso-io/kyso-model';
import { DynamicModule } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { db } from '../../main';
import { TeamMemberMongoProvider } from './providers/mongo-team-member.provider';
import { TeamsMongoProvider } from './providers/mongo-teams.provider';
import { TeamsController } from './teams.controller';
import { createProvider, TeamsService } from './teams.service';

export class TeamsModule {
  static forRoot(): DynamicModule {
    const dynamicProvider = createProvider();

    return {
      module: TeamsModule,
      providers: [TeamsService, TeamsMongoProvider, TeamMemberMongoProvider, dynamicProvider],
      controllers: [TeamsController],
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
