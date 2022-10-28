import { KysoSetting, KysoSettingsEnum } from '@kyso-io/kyso-model';
import { DynamicModule } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { db } from '../../main';
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
      exports: [dynamicProvider, baseCommentDynamicProvider],
      controllers: [CommentsController],
    };
  }
}
