import { Injectable, Logger } from '@nestjs/common'
import { MongoProvider } from 'src/providers/mongo.provider'
import { db } from 'src/main'

@Injectable()
export class CommentsMongoProvider extends MongoProvider {
    provider: any

    constructor() {
        super('Comment', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }

}
