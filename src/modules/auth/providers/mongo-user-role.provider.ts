import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class UserRoleMongoProvider extends MongoProvider<any> {
    constructor() {
        super('UserRole', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }
}
