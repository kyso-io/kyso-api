import { InlineComment } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class MongoInlineCommentsProvider extends MongoProvider<InlineComment> {
    version = 2

    constructor() {
        super('InlineComment', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }

    /**
     * New properties
     *     - markAsDeleted: boolean
     *     - mentions: string[]
     *
     * This migration do:
     *     - Iterates through every document in InlineComments collection
     *     - For each of them:
     *         - Looks for property markAsDeleted and, if not exists, set it to false
     *         - Looks for property mentions and, if not existst, set it to []
     *
     */
     async migrate_from_1_to_2() {
        Logger.log("Migrating to InlineComments version 2")
        
        const cursor = await this.getCollection().find({})
        const allInlineComments: any[] = await cursor.toArray()

        for (let inlineComment of allInlineComments) {
            let markedAsDeleted;
            let mentions;

            if(!inlineComment.hasOwnProperty("markAsDeleted")) {
                markedAsDeleted = false;
            } else {
                markedAsDeleted = inlineComment.markedAsDeleted;
            }

            if(!inlineComment.hasOwnProperty("mentions")) {
                mentions = [];
            } else {
                mentions = inlineComment.mentions;
            }

            await this.update(
                { id: inlineComment.id },
                {
                    $set: {
                        mentions: mentions,
                        markedAsDeleted: markedAsDeleted
                    },
                },
            )
        }
    }
}
