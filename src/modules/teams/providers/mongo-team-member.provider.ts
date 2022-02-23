import { TeamMemberJoin } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class TeamMemberMongoProvider extends MongoProvider<TeamMemberJoin> {
    version = 1
    
    constructor() {
        super('TeamMember', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }

    async getMembers(teamId: string): Promise<TeamMemberJoin[]> {
        const allMembers = await this.read({ filter: { team_id: teamId } })

        return allMembers
    }
}
