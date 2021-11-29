import { Injectable } from '@nestjs/common'
import { NotFoundError } from 'src/helpers/errorHandling'
import { Team } from 'src/model/team.model'
import { TeamsMongoProvider } from 'src/modules/teams/providers/mongo-teams.provider'

const PERMISSION_LEVELS = ['none', 'viewer', 'editor', 'admin']

@Injectable()
export class TeamsService {
    constructor(private readonly provider: TeamsMongoProvider) {}

    async getTeam(query) {
        const teams = await this.provider.read(query)
        if (teams.length === 0)
            throw new NotFoundError({
                message: "The specified team couldn't be found",
            })
        return teams[0]
    }

    async updateTeam(filterQuery, updateQuery) {
        const user = await this.provider.update(filterQuery, updateQuery)
        return user
    }

    async hasPermissionLevel(userId, teamName, level) {
        const permissionRequired = PERMISSION_LEVELS.indexOf(level)
        const permissionLevel = PERMISSION_LEVELS.indexOf(
            await this.provider.getPermissionLevel(userId, teamName),
        )
        if (permissionRequired === -1) {
            console.log(
                `teamsService.hasPermission has received an invalid permission level: ${level}! Action not allowed.`,
            )
            return false
        }

        return permissionLevel >= permissionRequired
    }
}
