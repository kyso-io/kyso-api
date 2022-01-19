import { Relation } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { ObjectId } from 'mongodb'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class RelationsMongoProvider extends MongoProvider<Relation> {
    provider: any

    constructor() {
        super('Relation', db)
    }

    async readFromCollectionByIds(collection, ids) {
        const cursor = await this.getCollection(collection).find({ _id: { $in: ids.map((id) => new ObjectId(id)) } })

        return cursor.toArray()
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }
}
