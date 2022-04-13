import { UserVerification } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class UserVerificationMongoProvider extends MongoProvider<UserVerification> {
    version = 1

    constructor() {
        super('UserVerification', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }
}
