import { DraftReport, Report } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class DraftReportsMongoProvider extends MongoProvider<DraftReport> {
    version = 1

    constructor() {
        super('DraftReport', db);
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }
}
