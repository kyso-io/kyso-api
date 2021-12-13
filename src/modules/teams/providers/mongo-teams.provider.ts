import { Injectable, Logger } from '@nestjs/common'
import { MongoProvider } from 'src/providers/mongo.provider'
import { db } from 'src/main'

@Injectable()
export class TeamsMongoProvider extends MongoProvider {
    rolesProvider: MongoProvider

    constructor() {
        super('Team', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }
}
