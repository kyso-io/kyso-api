import { Injectable, Logger } from '@nestjs/common'
import { MongoProvider } from 'src/providers/mongo.provider'
import { db } from 'src/main'
import { Team } from 'src/model/team.model'

@Injectable()
export class TeamsMongoProvider extends MongoProvider<Team> {
    constructor() {
        super('Team', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }
}
