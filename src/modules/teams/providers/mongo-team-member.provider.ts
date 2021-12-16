import { Injectable, Logger } from '@nestjs/common'
import { MongoProvider } from 'src/providers/mongo.provider'
import { TeamMemberJoin } from '../model/team-member-join.model'
import { db } from 'src/main'
import { TeamMember } from '../model/team-member.model'

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
