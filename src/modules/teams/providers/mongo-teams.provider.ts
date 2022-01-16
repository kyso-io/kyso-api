import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { Team } from '../../../model/team.model'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class TeamsMongoProvider extends MongoProvider<Team> {
    constructor() {
        super('Team', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }
}
