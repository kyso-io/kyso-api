import { Team } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import slug from '../../../helpers/slugify'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class TeamsMongoProvider extends MongoProvider<Team> {
    version = 2
    constructor() {
        super('Team', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }

    /**
     * Refactored properties:
     *     - nickname to display_name
     *     - name to sluglified_name
     * 
     * This migration do:
     *     - Iterates through every document in Teams collection
     *     - For each of them:
     *         - Read nickname and name properties
     *         - Updates new display_name with nickname value
     *         - Updates new sluglified_name with name value, but sluglifing it
     *         - Updates name value as well but sluglifing it
     * 
     * This migration DOES NOT DELETE name nor nickname, to be backwards compatible, but these properties are deprecated and will be deleted in next migrations
     *
     */
    async migrate_from_1_to_2() {
        const cursor = await this.getCollection().find({})
        const allTeams: any[] = await cursor.toArray()

        for(let team of allTeams) {
            const data: any = {
                display_name: team.nickname,
                name: slug(team.name),
                sluglified_name: slug(team.name)
            }

            await this.update(
                { _id: this.toObjectId(team.id) },
                {
                    $set: data,
                },
            )
        }

        // This is made automatically, so don't need to add it explicitly
        // await this.saveModelVersion(2)      
    }
}
