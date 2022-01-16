import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { TeamMemberJoin } from '../../../model/team-member-join.model'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class TeamMemberMongoProvider extends MongoProvider<any> {
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
