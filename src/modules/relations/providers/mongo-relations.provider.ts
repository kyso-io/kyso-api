import { Injectable, Logger } from '@nestjs/common'
import { MongoProvider } from 'src/providers/mongo.provider'
import { db } from 'src/main'
import { Relation } from 'src/model/relation.model'
import { ObjectId } from 'mongodb'

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
