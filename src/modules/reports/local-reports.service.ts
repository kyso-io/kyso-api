import { Injectable } from '@nestjs/common'
import { FilesMongoProvider } from './providers/mongo-files.provider'
import { VersionsMongoProvider } from './providers/mongo-versions.provider'
import { FilesS3Provider } from './providers/s3-files.provider'

@Injectable()
export class LocalReportsService {
    constructor(
        private readonly versionsProvider: VersionsMongoProvider,
        private readonly fileProvider: FilesS3Provider,
        private readonly fileDataProvider: FilesMongoProvider,
    ) {}

    async getReportVersions(reportId) {
        const versions = await this.versionsProvider.getReportVersions(reportId)
        const latest = versions.reduce((prev, curr) => (prev.created_at > curr ? prev : curr), 0)

        return versions.map((version) => ({
            name: version.id,
            commit: version.name,
            is_default: latest.id === version.id,
        }))
    }

    async getFileHash(reportId, version) {
        const { filesArray } = await this.versionsProvider.getReportVersion(reportId, version)
        const filesId = filesArray.map((file) => file.objectId)

        const files = await this.fileDataProvider.read({
            filter: { _id: { $in: filesId } },
        })
        return files.map((file) => ({
            type: 'file',
            path: file.name,
            hash: file.sha,
        }))
    }

    async getFileContent(reportId, hash) {
        const file = await this.fileDataProvider.getFile(hash)
        const content = await this.fileProvider.getFile(file.file)

        return content
    }
}
