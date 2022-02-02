import { Injectable, Provider } from '@nestjs/common'
import { AutowiredService } from '../../generic/autowired.generic'
import { FilesMongoProvider } from './providers/mongo-files.provider'
import { VersionsMongoProvider } from './providers/mongo-versions.provider'
import { FilesS3Provider } from './providers/s3-files.provider'

function factory(service: LocalReportsService) {
    return service
}

export function createLocalReportsProvider(): Provider<LocalReportsService> {
    return {
        provide: `${LocalReportsService.name}`,
        useFactory: (service) => factory(service),
        inject: [LocalReportsService],
    }
}

@Injectable()
export class LocalReportsService extends AutowiredService {
    constructor(
        private readonly versionsProvider: VersionsMongoProvider,
        private readonly fileProvider: FilesS3Provider,
        private readonly fileDataProvider: FilesMongoProvider,
    ) {
        super()
    }

    async getReportVersions(reportId: string) {
        const versions = await this.versionsProvider.getReportVersions(reportId)
        const latest = versions.reduce((prev, curr) => (prev.created_at > curr ? prev : curr), 0)

        return versions.map((version) => ({
            name: version.id,
            commit: version.name,
            is_default: latest.id === version.id,
        }))
    }
}
