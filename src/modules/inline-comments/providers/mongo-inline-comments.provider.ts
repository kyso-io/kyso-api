import { InlineComment } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class MongoInlineCommentsProvider extends MongoProvider<InlineComment> {
    version = 1
    constructor() {
        super('InlineComment', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }
}
