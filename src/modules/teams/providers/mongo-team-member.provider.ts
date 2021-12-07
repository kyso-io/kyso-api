import { Injectable } from '@nestjs/common'
import { MongoProvider } from 'src/providers/mongo.provider'
import { TeamMemberJoin } from '../model/team-member-join.model'

@Injectable()
export class TeamMemberMongoProvider extends MongoProvider {
    constructor() {
        super('TeamMember')
    }

    async getMembers(teamId: string): Promise<TeamMemberJoin[]> {
        const allMembers = await this.read({ filter: { team_id: teamId } })

        return allMembers
    }
}
