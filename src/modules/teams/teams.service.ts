import {
    KysoRole,
    Organization,
    OrganizationMemberJoin,
    Report,
    Team,
    TeamMember,
    TeamMemberJoin,
    TeamVisibilityEnum,
    Token,
    UpdateTeamMembers,
    User,
} from '@kyso-io/kyso-model'
import { Injectable, PreconditionFailedException, Provider } from '@nestjs/common'
import { existsSync, unlinkSync } from 'fs'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { userHasPermission } from '../../helpers/permissions'
import { GlobalPermissionsEnum } from '../../security/general-permissions.enum'
import { OrganizationsService } from '../organizations/organizations.service'
import { ReportsService } from '../reports/reports.service'
import { ReportPermissionsEnum } from '../reports/security/report-permissions.enum'
import { UsersService } from '../users/users.service'
import { TeamMemberMongoProvider } from './providers/mongo-team-member.provider'
import { TeamsMongoProvider } from './providers/mongo-teams.provider'

function factory(service: TeamsService) {
    return service
}

export function createProvider(): Provider<TeamsService> {
    return {
        provide: `${TeamsService.name}`,
        useFactory: (service) => factory(service),
        inject: [TeamsService],
    }
}

@Injectable()
export class TeamsService extends AutowiredService {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    @Autowired({ typeName: 'OrganizationsService' })
    private organizationsService: OrganizationsService

    @Autowired({ typeName: 'ReportsService' })
    private reportsService: ReportsService

    constructor(private readonly provider: TeamsMongoProvider, private readonly teamMemberProvider: TeamMemberMongoProvider) {
        super()
    }

    public async getTeamById(id: string): Promise<Team> {
        return this.getTeam({ filter: { _id: this.provider.toObjectId(id) } })
    }

    async getTeam(query) {
        const teams = await this.provider.read(query)
        if (teams.length === 0) {
            return null
        }
        return teams[0]
    }

    async getTeams(query) {
        return await this.provider.read(query)
    }

    /**
     * Get all teams that are visible for the specified user
     *
     * @param user
     */
    async getTeamsVisibleForUser(userId: string): Promise<Team[]> {
        // All public teams
        const userTeamsResult = await this.getTeams({ filter: { visibility: TeamVisibilityEnum.PUBLIC } })

        // All protected teams from organizations that the user belongs
        const allUserOrganizations: OrganizationMemberJoin[] = await this.organizationsService.searchMembersJoin({ filter: { member_id: userId } })

        for (const organizationMembership of allUserOrganizations) {
            const result = await this.getTeams({
                filter: {
                    organization_id: organizationMembership.organization_id,
                    visibility: TeamVisibilityEnum.PROTECTED,
                },
            })

            userTeamsResult.push(...result)
        }

        // All teams (whenever is public, private or protected) in which user is member
        const members = await this.searchMembers({ filter: { member_id: userId } })

        for (const m of members) {
            const result = await this.getTeam({ filter: { _id: this.provider.toObjectId(m.team_id) } })
            if (result) {
                userTeamsResult.push(result)
            }
        }

        return [...new Set(userTeamsResult)]
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
        const teams: Team[] = await this.provider.read({ filter: { name: teamName } })

        if (teams && teams.length > 0) {
            // Get all the members of this team
            const members: TeamMemberJoin[] = await this.teamMemberProvider.getMembers(teams[0].id)

            // Build query object to retrieve all the users
            const user_ids = members.map((x: TeamMemberJoin) => {
                return x.member_id
            })

            // Build the query to retrieve all the users
            const filterArray = user_ids.map((id: string) => ({ _id: this.provider.toObjectId(id) }))

            if (filterArray.length === 0) {
                return []
            }

            const filter = { filter: { $or: filterArray } }

            const users = await this.usersService.getUsers(filter)

            const usersAndRoles = users.map((u: User) => {
                // Find role for this user in members
                const thisMember: TeamMemberJoin = members.find((tm: TeamMemberJoin) => u.id.toString() === tm.member_id)

                return { ...u, roles: thisMember.role_names }
            })

            return usersAndRoles.map((x) => new TeamMember(x.id.toString(), x.nickname, x.username, x.roles, x.bio, x.avatar_url, x.email))
        } else {
            return []
        }
    }

    async updateTeam(filterQuery, updateQuery) {
        const user = await this.provider.update(filterQuery, updateQuery)
        return user
    }

    async createTeam(team: Team) {
        try {
            // The name of this team exists?
            const teams: Team[] = await this.provider.read({ filter: { name: team.name } })
            if (teams.length > 0) {
                // Exists, throw an exception
                throw new PreconditionFailedException('The name of the team must be unique')
            }

            const organization: Organization = await this.organizationsService.getOrganization({
                filter: { _id: this.provider.toObjectId(team.organization_id) },
            })
            if (!organization) {
                throw new PreconditionFailedException('The organization does not exist')
            }

            const users: User[] = await this.usersService.getUsers({ filter: { nickname: team.name } })
            if (users.length > 0) {
                throw new PreconditionFailedException('There is already a user with this nickname')
            }

            return this.provider.create(team)
        } catch (e) {
            console.log(e)
        }
    }

    public async getReportsOfTeam(token: Token, teamName: string): Promise<Report[]> {
        const teams: Team[] = await this.provider.read({ filter: { name: teamName } })
        if (teams.length === 0) {
            throw new PreconditionFailedException('Team not found')
        }
        const team: Team = teams[0]
        const reports: Report[] = await this.reportsService.getReports({ filter: { team_id: team.id } })
        const userTeams: Team[] = await this.getTeamsVisibleForUser(token.id)
        const userInTeam: boolean = userTeams.find((x) => x.id === team.id) !== undefined
        const members: OrganizationMemberJoin[] = await this.organizationsService.getMembers(team.organization_id)
        const userBelongsToOrganization: boolean = members.find((x: OrganizationMemberJoin) => x.member_id === token.id) !== undefined
        const hasGlobalPermissionAdmin: boolean = userHasPermission(token, GlobalPermissionsEnum.GLOBAL_ADMIN)
        if (team.visibility === TeamVisibilityEnum.PUBLIC) {
            if (!userInTeam && !userBelongsToOrganization && !hasGlobalPermissionAdmin) {
                throw new PreconditionFailedException('You are not a member of this team and not of the organization')
            }
            return reports
        } else if (team.visibility === TeamVisibilityEnum.PROTECTED) {
            if (!userInTeam && !userBelongsToOrganization) {
                throw new PreconditionFailedException('You are not a member of this team and not of the organization')
            }
            const userHasReportPermissionRead: boolean = userHasPermission(token, ReportPermissionsEnum.READ)
            const userHasReportPermissionAdmin: boolean = userHasPermission(token, ReportPermissionsEnum.ADMIN)
            if (!userHasReportPermissionRead && !userHasReportPermissionAdmin && !hasGlobalPermissionAdmin && !userBelongsToOrganization) {
                throw new PreconditionFailedException('User does not have permission to read reports')
            }
            return reports
        } else if (team.visibility === TeamVisibilityEnum.PRIVATE) {
            if (!hasGlobalPermissionAdmin && !userInTeam) {
                throw new PreconditionFailedException('You are not a member of this team')
            }
            const userHasReportPermissionRead: boolean = userHasPermission(token, ReportPermissionsEnum.READ)
            const userHasReportPermissionAdmin: boolean = userHasPermission(token, ReportPermissionsEnum.ADMIN)
            if (!userHasReportPermissionRead && !userHasReportPermissionAdmin && !hasGlobalPermissionAdmin) {
                throw new PreconditionFailedException('User does not have permission to read reports')
            }
            return reports
        }
        return []
    }

    public async deleteGivenOrganization(organization_id: string): Promise<void> {
        // Get all team  of the organization
        const teams: Team[] = await this.getTeams({ filter: { organization_id } })
        for (const team of teams) {
            // Delete all members of this team
            await this.teamMemberProvider.delete({ filter: { team_id: team.id } })
            // Delete team
            await this.provider.delete({ filter: { _id: this.provider.toObjectId(team.id) } })
        }
    }

    public async getUserTeams(user_id: string): Promise<Team[]> {
        const userInTeams: TeamMemberJoin[] = await this.teamMemberProvider.read({ filter: { member_id: user_id } })
        return this.provider.read({ filter: { _id: { $in: userInTeams.map((x) => this.provider.toObjectId(x.team_id)) } } })
    }

    public async userBelongsToTeam(teamName: string, email: string): Promise<boolean> {
        const team: Team = await this.getTeam({
            filter: { name: teamName },
        })
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }

        const user: User = await this.usersService.getUser({
            filter: { email },
        })
        if (!user) {
            throw new PreconditionFailedException('User not found')
        }

        const members: TeamMember[] = await this.getMembers(teamName)
        const index: number = members.findIndex((member: TeamMember) => member.id === user.id)
        return index !== -1
    }

    public async addMemberToTeam(teamName: string, email: string): Promise<TeamMember[]> {
        const userBelongsToTeam = await this.userBelongsToTeam(teamName, email)
        if (userBelongsToTeam) {
            throw new PreconditionFailedException('User already belongs to this team')
        }
        const team: Team = await this.getTeam({
            filter: { name: teamName },
        })
        const user: User = await this.usersService.getUser({
            filter: { email },
        })
        await this.addMembersById(team.id, [user.id], [])
        return this.getMembers(teamName)
    }

    public async removeMemberFromTeam(teamName: string, userName: string): Promise<TeamMember[]> {
        const team: Team = await this.getTeam({ filter: { name: teamName } })
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }

        const user: User = await this.usersService.getUser({ filter: { username: userName } })
        if (!user) {
            throw new PreconditionFailedException('User not found')
        }

        const members: TeamMemberJoin[] = await this.teamMemberProvider.read({ filter: { team_id: team.id } })
        const index: number = members.findIndex((x) => x.member_id === user.id)
        if (index === -1) {
            throw new PreconditionFailedException('User is not a member of this team')
        }

        await this.teamMemberProvider.delete({ team_id: team.id, member_id: user.id })
        members.splice(index, 1)

        if (members.length === 0) {
            // Team without members, delete it
            await this.provider.delete({ _id: this.provider.toObjectId(team.id) })
        }

        return this.getMembers(teamName)
    }

    public async updateTeamMembersRoles(teamName: string, data: UpdateTeamMembers): Promise<TeamMember[]> {
        const team: Team = await this.getTeam({ filter: { name: teamName } })
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }

        const validRoles: string[] = team.roles.map((role: KysoRole) => role.name)

        const members: TeamMemberJoin[] = await this.teamMemberProvider.getMembers(team.id)
        for (const element of data.members) {
            const user: User = await this.usersService.getUser({ filter: { username: element.username } })
            if (!user) {
                throw new PreconditionFailedException('User does not exist')
            }
            const member: TeamMemberJoin = members.find((x: TeamMemberJoin) => x.member_id === user.id)
            if (!member) {
                throw new PreconditionFailedException('User is not a member of this team')
            }
            const role: string = member.role_names.find((x: string) => x === element.role)
            if (!role) {
                if (!validRoles.includes(element.role)) {
                    throw new PreconditionFailedException(`Role ${element.role} is not valid`)
                }
                await this.teamMemberProvider.update({ _id: this.provider.toObjectId(member.id) }, { $push: { role_names: element.role } })
            } else {
                throw new PreconditionFailedException('User already has this role')
            }
        }

        return this.getMembers(teamName)
    }

    public async removeTeamMemberRole(teamName: string, userName: string, role: string): Promise<TeamMember[]> {
        const team: Team = await this.getTeam({ filter: { name: teamName } })
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }
        const user: User = await this.usersService.getUser({ filter: { username: userName } })
        if (!user) {
            throw new PreconditionFailedException('User does not exist')
        }
        const members: TeamMemberJoin[] = await this.teamMemberProvider.getMembers(team.id)
        const member: TeamMemberJoin = members.find((x: TeamMemberJoin) => x.member_id === user.id)
        if (!member) {
            throw new PreconditionFailedException('User is not a member of this team')
        }
        const index: number = member.role_names.findIndex((x: string) => x === role)
        if (index === -1) {
            throw new PreconditionFailedException('User does not have this role')
        }
        await this.teamMemberProvider.update({ _id: this.provider.toObjectId(member.id) }, { $pull: { role_names: role } })
        return this.getMembers(teamName)
    }

    // Commented type throwing an Namespace 'global.Express' has no exported member 'Multer' error
    public async setProfilePicture(teamName: string, file: any /*Express.Multer.File*/): Promise<Team> {
        const team: Team = await this.getTeam({ filter: { name: teamName } })
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }
        if (team?.avatar_url && team.avatar_url.length > 0) {
            const imagePath = `./public/${team.avatar_url}`
            if (existsSync(imagePath)) {
                unlinkSync(imagePath)
            }
        }
        const profilePicturePath: string = file.path.replace('public/', '')
        return this.provider.update({ _id: this.provider.toObjectId(team.id) }, { $set: { avatar_url: profilePicturePath } })
    }

    public async deleteProfilePicture(teamName: string): Promise<Team> {
        const team: Team = await this.getTeam({ filter: { name: teamName } })
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }
        if (team?.avatar_url && team.avatar_url.length > 0) {
            const imagePath = `./public/${team.avatar_url}`
            if (existsSync(imagePath)) {
                unlinkSync(imagePath)
            }
        }
        return this.provider.update({ _id: this.provider.toObjectId(team.id) }, { $set: { avatar_url: null } })
    }

    public async deleteTeam(teamName: string): Promise<Team> {
        const team: Team = await this.getTeam({ filter: { name: teamName } })
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }
        // Delete all members of this team
        await this.teamMemberProvider.delete({ team_id: team.id })
        // Delete team
        await this.provider.delete({ _id: this.provider.toObjectId(team.id) })
        return team
    }
}
