import { Tag } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class TagsMongoProvider extends MongoProvider<Tag> {
    version = 1
    
    constructor() {
        super('Tag', db, [
            {
                keys: {
                    name: 'text',
                },
            },
        ])
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }
}
