import { SearchUser } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../main'
import { MongoProvider } from '../../providers/mongo.provider'

@Injectable()
export class SearchUserMongoProvider extends MongoProvider<SearchUser> {
    version = 1

    constructor() {
        super('SearchUser', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }
}
