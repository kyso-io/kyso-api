import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { db } from 'src/main'
import { MongoProvider } from 'src/providers/mongo.provider'

@Injectable()
export class UsersMongoProvider extends MongoProvider {
    provider: any

    constructor() {
        super('User', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }
}
