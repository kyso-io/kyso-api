import { Injectable, Logger } from '@nestjs/common'
import { NotFoundError } from '../../../helpers/errorHandling'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class VersionsMongoProvider extends MongoProvider<any> {
    version = 1
    
    constructor() {
        super('Version', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }

    async getReportVersions(reportId) {
        const versions = await this.read({
            filter: {
                report_id: reportId,
            },
        })
        return versions
    }

    async getReportVersion(reportId, version) {
        const versions = await this.read({
            filter: {
                _id: version,
                report_id: reportId,
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
