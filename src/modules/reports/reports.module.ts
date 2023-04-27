import { DynamicModule, Provider } from '@nestjs/common';
import { NestjsFormDataModule } from 'nestjs-form-data';
import { registerNatsService } from '../../providers/nats-service-register';
import { FilesService, createFilesProvider } from './files.service';
import { DraftReportsMongoProvider } from './providers/mongo-draft-reports.provider';
import { FilesMongoProvider } from './providers/mongo-files.provider';
import { PinnedReportsMongoProvider } from './providers/mongo-pinned-reports.provider';
import { ReportsMongoProvider } from './providers/mongo-reports.provider';
import { StarredReportsMongoProvider } from './providers/mongo-starred-reports.provider';
import { ReportsAnalyticsMongoProvider } from './providers/reports-analytics.mongo-provider';
import { ReportsController } from './reports.controller';
import { ReportsService, createProvider } from './reports.service';
import { SftpService, createSftpProvider } from './sftp.service';

export class ReportsModule {
  static async forRoot(): Promise<DynamicModule> {
    const reportServiceDynamicProvider: Provider<ReportsService> = createProvider();
    const filesServicesDynamicProvider: Provider<FilesService> = createFilesProvider();
    const sftpDynamicProvider: Provider<SftpService> = createSftpProvider();
    return {
      module: ReportsModule,
      providers: [
        DraftReportsMongoProvider,
        FilesMongoProvider,
        FilesService,
        filesServicesDynamicProvider,
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
      exports: [filesServicesDynamicProvider, reportServiceDynamicProvider],
    };
  }
}
