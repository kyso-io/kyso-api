import { Injectable, PreconditionFailedException } from '@nestjs/common'
import { userHasPermission } from '../../helpers/permissions'
import { organizationsService, reportsService, usersService } from '../../main'
import { TeamVisibilityEnum } from '../../model/enum/team-visibility.enum'
import { KysoRole } from '../../model/kyso-role.model'
import { OrganizationMemberJoin } from '../../model/organization-member-join.model'
import { Organization } from '../../model/organization.model'
import { Report } from '../../model/report.model'
import { TeamMemberJoin } from '../../model/team-member-join.model'
import { TeamMember } from '../../model/team-member.model'
import { Team } from '../../model/team.model'
import { Token } from '../../model/token.model'
import { User } from '../../model/user.model'
import { GlobalPermissionsEnum } from '../../security/general-permissions.enum'
import { ReportPermissionsEnum } from '../reports/security/report-permissions.enum'
import { TeamMemberMongoProvider } from './providers/mongo-team-member.provider'
import { TeamsMongoProvider } from './providers/mongo-teams.provider'

@Injectable()
export class TeamsService {
    constructor(private readonly provider: TeamsMongoProvider, private readonly teamMemberProvider: TeamMemberMongoProvider) {}

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
        const allUserOrganizations: OrganizationMemberJoin[] = await organizationsService.searchMembersJoin({ filter: { member_id: userId } })

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
            const result = await this.getTeam({ filter: { id: m.team_id } })
            userTeamsResult.push(result)
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
        const team: Team[] = await this.provider.read({ filter: { name: teamName } })

        if (team) {
            // Get all the members of this team
            const members: TeamMemberJoin[] = await this.teamMemberProvider.getMembers(team[0].id)

            // Build query object to retrieve all the users
            const user_ids = members.map((x: TeamMemberJoin) => {
                return x.member_id
            })

            // Build the query to retrieve all the users
            const filterArray = []
            user_ids.forEach((id: string) => {
                filterArray.push({ _id: id })
            })

            const filter = { filter: { $or: filterArray } }

            const users = await usersService.getUsers(filter)

            const usersAndRoles = users.map((u: User) => {
                // Find role for this user in members
                const thisMember: TeamMemberJoin = members.find((tm: TeamMemberJoin) => u.id.toString() === tm.member_id)

                return { ...u, roles: thisMember.role_names }
            })

            const toFinalObject = usersAndRoles.map((x) => {
                const obj: TeamMember = new TeamMember()

                obj.avatar_url = x.avatar_url
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
        }

        const organization: Organization = await organizationsService.getOrganization({ _id: team.organization_id })
        if (!organization) {
            throw new PreconditionFailedException('The organization does not exist')
        }

        return this.provider.create(team)
    }

    public async getReportsOfTeam(token: Token, teamName: string): Promise<Report[]> {
        const teams: Team[] = await this.provider.read({ filter: { name: teamName } })
        if (teams.length === 0) {
            throw new PreconditionFailedException('Team not found')
        }
        const team: Team = teams[0]
        const reports: Report[] = await reportsService.getReports({ filter: { team_id: team.id } })
        const userTeams: Team[] = await this.getTeamsVisibleForUser(token.id)
        const userInTeam: boolean = userTeams.find((x) => x.id === team.id) !== undefined
        const members: OrganizationMemberJoin[] = await organizationsService.getMembers(team.organization_id)
        const userBelongsToOrganization: boolean = members.find((x: OrganizationMemberJoin) => x.member_id === token.id) !== undefined
        if (team.visibility === TeamVisibilityEnum.PUBLIC) {
            if (!userInTeam && !userBelongsToOrganization) {
                throw new PreconditionFailedException('You are not a member of this team and not of the organization')
            }
            return reports
        } else if (team.visibility === TeamVisibilityEnum.PROTECTED) {
            if (!userInTeam && !userBelongsToOrganization) {
                throw new PreconditionFailedException('You are not a member of this team and not of the organization')
            }
            const userHasReportPermissionRead: boolean = userHasPermission(token, ReportPermissionsEnum.READ)
            const userHasReportPermissionAdmin: boolean = userHasPermission(token, ReportPermissionsEnum.ADMIN)
            const hasGlobalPermissionAdmin: boolean = userHasPermission(token, GlobalPermissionsEnum.GLOBAL_ADMIN)
            if (!userHasReportPermissionRead && !userHasReportPermissionAdmin && !hasGlobalPermissionAdmin && !userBelongsToOrganization) {
                throw new PreconditionFailedException('User does not have permission to read reports')
            }
            return reports
        } else if (team.visibility === TeamVisibilityEnum.PRIVATE) {
            if (!userInTeam) {
                throw new PreconditionFailedException('You are not a member of this team')
            }
            const userHasReportPermissionRead: boolean = userHasPermission(token, ReportPermissionsEnum.READ)
            const userHasReportPermissionAdmin: boolean = userHasPermission(token, ReportPermissionsEnum.ADMIN)
            const hasGlobalPermissionAdmin: boolean = userHasPermission(token, GlobalPermissionsEnum.GLOBAL_ADMIN)
            if (!userHasReportPermissionRead && !userHasReportPermissionAdmin && !hasGlobalPermissionAdmin) {
                throw new PreconditionFailedException('User does not have permission to read reports')
            }
            return reports
        }
        return []
    }
}
