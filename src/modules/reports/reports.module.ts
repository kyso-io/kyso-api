import { KysoSetting, KysoSettingsEnum } from '@kyso-io/kyso-model';
import { DynamicModule } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NestjsFormDataModule } from 'nestjs-form-data';
import { db } from '../../main';
import { DraftReportsMongoProvider } from './providers/mongo-draft-reports.provider';
import { FilesMongoProvider } from './providers/mongo-files.provider';
import { PinnedReportsMongoProvider } from './providers/mongo-pinned-reports.provider';
import { ReportsMongoProvider } from './providers/mongo-reports.provider';
import { StarredReportsMongoProvider } from './providers/mongo-starred-reports.provider';
import { ReportsController } from './reports.controller';
import { createProvider, ReportsService } from './reports.service';
import { createSftpProvider, SftpService } from './sftp.service';

export class ReportsModule {
  static async forRoot(): Promise<DynamicModule> {
    const reportServiceDynamicProvider = createProvider();
    const sftpDynamicProvider = createSftpProvider();

    return {
      module: ReportsModule,
      providers: [
        FilesMongoProvider,
        reportServiceDynamicProvider,
        PinnedReportsMongoProvider,
        ReportsService,
        ReportsMongoProvider,
        sftpDynamicProvider,
        SftpService,
        StarredReportsMongoProvider,
        DraftReportsMongoProvider,
      ],
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
        NestjsFormDataModule,
      ],
      controllers: [ReportsController],
      exports: [reportServiceDynamicProvider],
    };
  }
}
