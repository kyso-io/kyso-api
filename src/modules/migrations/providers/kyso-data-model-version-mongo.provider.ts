import { Invitation } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class KysoDataModelVersionProvider extends MongoProvider<Invitation> {
    constructor() {
        super('KysoDataModelVersion', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }
}
