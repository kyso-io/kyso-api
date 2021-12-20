import { forwardRef, Inject, Injectable, Logger, PreconditionFailedException } from '@nestjs/common'
import { NotFoundError } from 'src/helpers/errorHandling'
import { Team } from 'src/model/team.model'
import { User } from 'src/model/user.model'
import { TeamsMongoProvider } from 'src/modules/teams/providers/mongo-teams.provider'
import { UsersService } from '../users/users.service'
import { TeamMemberJoin } from './model/team-member-join.model'
import { TeamMember } from './model/team-member.model'
import { TeamMemberMongoProvider } from './providers/mongo-team-member.provider'
import * as mongo from 'mongodb'
import { KysoRole } from '../../model/kyso-role.model'

@Injectable()
export class TeamsService {
    constructor(
        private readonly provider: TeamsMongoProvider,
        private readonly teamMemberProvider: TeamMemberMongoProvider,
        @Inject(forwardRef(() => UsersService))
        private readonly usersService: UsersService,
    ) {}

    async getTeam(query) {
        const teams = await this.provider.read(query)
        if (teams.length === 0) {
            throw new NotFoundError({
                message: "The specified team couldn't be found",
            })
        }
        return teams[0]
    }

    async getTeams(query) {
        return await this.provider.read(query)
    }

    async searchMembers(query: any): Promise<TeamMemberJoin[]> {
        return this.teamMemberProvider.read(query) as Promise<TeamMemberJoin[]>
    }

    async addMembers(teamName: string, members: User[], roles: KysoRole[]) {
        const team: Team = await this.getTeam({ filter: { name: teamName } })
        const memberIds = members.map((x) => x.id.toString())
        const rolesToApply = roles.map((y) => y.name)

        await this.addMembersById(team.id, memberIds, rolesToApply)
    }

    async addMembersById(teamId: string, memberIds: string[], rolesToApply: string[]) {
        memberIds.forEach(async (userId: string) => {
            const member: TeamMemberJoin = new TeamMemberJoin(teamId, userId, rolesToApply, true)

            await this.teamMemberProvider.create(member)
        })
    }

    async getMembers(teamName: string) {
        const team: Team[] = await this.provider.read({ filter: { name: teamName } })

        if (team) {
            // Get all the members of this team
            const members: TeamMemberJoin[] = await this.teamMemberProvider.getMembers(team[0].id)

            // Build query object to retrieve all the users
            const user_ids = members.map((x: TeamMemberJoin) => {
                return x.member_id
            })

            // Build the query to retrieve all the users
            let filterArray = []
            user_ids.forEach((id: string) => {
                filterArray.push({ _id: id })
            })

            let filter = { filter: { $or: filterArray } }

            let users = await this.usersService.getUsers(filter)

            let usersAndRoles = users.map((u: User) => {
                // Find role for this user in members
                const thisMember: TeamMemberJoin = members.find((tm: TeamMemberJoin) => u.id.toString() === tm.member_id)

                return { ...u, roles: thisMember.role_names }
            })

            const toFinalObject = usersAndRoles.map((x) => {
                let obj: TeamMember = new TeamMember()

                obj.avatar_url = x.avatarUrl
                obj.bio = x.bio
                obj.id = x.id.toString()
                obj.nickname = x.nickname
                obj.team_roles = x.roles
                obj.username = x.username
                obj.email = x.email

                return obj
            })

            return toFinalObject
        } else {
            return []
        }
    }

    async updateTeam(filterQuery, updateQuery) {
        const user = await this.provider.update(filterQuery, updateQuery)
        return user
    }

    async createTeam(team: Team) {
        // The name of this team exists?
        const exists: any[] = await this.provider.read({ filter: { name: team.name } })

        if (exists.length > 0) {
            // Exists, throw an exception
            throw new PreconditionFailedException('The name of the team must be unique')
        } else {
            return this.provider.create(team)
        }
    }
}
