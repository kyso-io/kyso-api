import { Injectable, Logger } from '@nestjs/common'
import { NotFoundError } from 'src/helpers/errorHandling'
import { QueryParser } from 'src/helpers/queryParser'
import { MongoProvider } from 'src/providers/mongo.provider'
import { db } from 'src/main'

@Injectable()
export class VersionsMongoProvider extends MongoProvider {
    constructor() {
        super('Version', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }

    async getReportVersions(reportId) {
        const versions = await this.read({
            filter: {
                _p_study: QueryParser.createForeignKey('Study', reportId),
            },
        })
        return versions
    }

    async getReportVersion(reportId, version) {
        const versions = await this.read({
            filter: {
                _id: version,
                _p_study: QueryParser.createForeignKey('Study', reportId),
            },
            limit: 1,
        })

        if (versions.length === 0)
            throw new NotFoundError({
                message: "The specified version couldn't be found",
            })
        return versions[0]
    }
}
