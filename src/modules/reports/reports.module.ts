import { DynamicModule } from '@nestjs/common';
import { NestjsFormDataModule } from 'nestjs-form-data';
import { registerNatsService } from '../../providers/nats-service-register';
import { DraftReportsMongoProvider } from './providers/mongo-draft-reports.provider';
import { FilesMongoProvider } from './providers/mongo-files.provider';
import { PinnedReportsMongoProvider } from './providers/mongo-pinned-reports.provider';
import { ReportsMongoProvider } from './providers/mongo-reports.provider';
import { StarredReportsMongoProvider } from './providers/mongo-starred-reports.provider';
import { ReportsAnalyticsMongoProvider } from './providers/reports-analytics.mongo-provider';
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
        DraftReportsMongoProvider,
        FilesMongoProvider,
        PinnedReportsMongoProvider,
        ReportsAnalyticsMongoProvider,
        ReportsService,
        ReportsMongoProvider,
        reportServiceDynamicProvider,
        sftpDynamicProvider,
        SftpService,
        StarredReportsMongoProvider,
      ],
      imports: [registerNatsService(), NestjsFormDataModule],
      controllers: [ReportsController],
      exports: [reportServiceDynamicProvider],
    };
  }
}
