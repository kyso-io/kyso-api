import { DynamicModule } from '@nestjs/common'
import { GithubReposModule } from '../github-repos/github-repos.module'
import { GithubReposService } from '../github-repos/github-repos.service'
import { createLocalReportsProvider, LocalReportsService } from './local-reports.service'
import { FilesMongoProvider } from './providers/mongo-files.provider'
import { PinnedReportsMongoProvider } from './providers/mongo-pinned-reports.provider'
import { ReportsMongoProvider } from './providers/mongo-reports.provider'
import { StarredReportsMongoProvider } from './providers/mongo-starred-reports.provider'
import { VersionsMongoProvider } from './providers/mongo-versions.provider'
import { FilesS3Provider } from './providers/s3-files.provider'
import { PruebaService } from './prueba.service'
import { ReportsController } from './reports.controller'
import { createProvider, ReportsService } from './reports.service'

export class ReportsModule {
    static forRoot(): DynamicModule {
        const reportServiceDynamicProvider = createProvider()
        const localRepositoryDynamicProvider = createLocalReportsProvider()

        return {
            module: ReportsModule,
            providers: [
                FilesS3Provider,
                FilesMongoProvider,
                localRepositoryDynamicProvider,
                LocalReportsService,
                reportServiceDynamicProvider,
                PinnedReportsMongoProvider,
                PruebaService,
                ReportsService,
                ReportsMongoProvider,
                StarredReportsMongoProvider,
                VersionsMongoProvider,
            ],
            controllers: [ReportsController],
            exports: [reportServiceDynamicProvider, localRepositoryDynamicProvider],
        }
    }
}
