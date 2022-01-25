import { Report } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class ReportsMongoProvider extends MongoProvider<Report> {
    constructor() {
        super('Report', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }
}
