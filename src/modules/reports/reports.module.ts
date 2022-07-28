import { KysoSetting, KysoSettingsEnum } from '@kyso-io/kyso-model'
import { DynamicModule } from '@nestjs/common'
import { ClientsModule, Transport } from '@nestjs/microservices'
import { db } from '../../main'
import { createLocalReportsProvider, LocalReportsService } from './local-reports.service'
import { FilesMongoProvider } from './providers/mongo-files.provider'
import { PinnedReportsMongoProvider } from './providers/mongo-pinned-reports.provider'
import { ReportsMongoProvider } from './providers/mongo-reports.provider'
import { StarredReportsMongoProvider } from './providers/mongo-starred-reports.provider'
import { VersionsMongoProvider } from './providers/mongo-versions.provider'
import { FilesS3Provider } from './providers/s3-files.provider'
import { ReportsController } from './reports.controller'
import { createProvider, ReportsService } from './reports.service'
import { createSftpProvider, SftpService } from './sftp.service'

export class ReportsModule {
    static async forRoot(): Promise<DynamicModule> {
        const reportServiceDynamicProvider = createProvider()
        const localRepositoryDynamicProvider = createLocalReportsProvider()
        const sftpDynamicProvider = createSftpProvider()

        return {
            module: ReportsModule,
            providers: [
                FilesS3Provider,
                FilesMongoProvider,
                localRepositoryDynamicProvider,
                LocalReportsService,
                reportServiceDynamicProvider,
                PinnedReportsMongoProvider,
                ReportsService,
                ReportsMongoProvider,
                sftpDynamicProvider,
                SftpService,
                StarredReportsMongoProvider,
                VersionsMongoProvider,
            ],
            imports: [
                ClientsModule.registerAsync([
                    {
                        name: 'NATS_SERVICE',
                        useFactory: async () => {
                            const kysoSettingCollection = db.collection('KysoSettings')
                            const server: KysoSetting[] = await kysoSettingCollection.find({ key: KysoSettingsEnum.KYSO_NATS_URL }).toArray()
                            return {
                                name: 'NATS_SERVICE',
                                transport: Transport.NATS,
                                options: {
                                    servers: server[0] ? [server[0].value] : [],
                                },
                            }
                        },
                    },
                ]),
            ],
            controllers: [ReportsController],
            exports: [reportServiceDynamicProvider, localRepositoryDynamicProvider],
        }
    }
}
