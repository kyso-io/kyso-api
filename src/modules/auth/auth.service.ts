import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common'
import { KysoLoginProvider } from './providers/kyso-login.provider'
import { LoginProvider } from './model/login-provider.enum'
import { GithubLoginProvider } from './providers/github-login.provider'
import { JwtService } from '@nestjs/jwt'
import { PlatformRoleMongoProvider } from './providers/mongo-platform-role.provider'
import { KysoRole } from './model/kyso-role.model'
import { TeamsService } from '../teams/teams.service'
import { UsersService } from '../users/users.service'
import { User } from 'src/model/user.model'
import { TeamMemberJoin } from '../teams/model/team-member-join.model'
import { OrganizationsService } from '../organizations/organizations.service'
import { OrganizationMemberJoin } from '../organizations/model/organization-member-join.model'
import { Team } from 'src/model/team.model'
import { Organization } from 'src/model/organization.model'
import * as mongo from 'mongodb'

@Injectable()
export class AuthService {
    constructor(
        private readonly kysoLoginProvider: KysoLoginProvider,
        private readonly githubLoginProvider: GithubLoginProvider,
        private readonly platformRoleProvider: PlatformRoleMongoProvider,
        private readonly jwtService: JwtService,
    ) {}

    async getPlatformRoles(): Promise<KysoRole[]> {
        return this.platformRoleProvider.read({})
    }

    static async buildFinalPermissionsForUser(
        username: string,
        userService: UsersService,
        teamService: TeamsService,
        organizationService: OrganizationsService,
        platformRoleProvider: PlatformRoleMongoProvider,
    ) {
        let response = []

        // Retrieve user object
        const user: User = await userService.getUser({ filter: { username: username } })

        // These are the generic platform roles in Kyso, can't be deleted. Are eternal.
        const platformRoles: KysoRole[] = await platformRoleProvider.read({})

        // Search for teams in which this user is a member
        const userTeamMembership: TeamMemberJoin[] = await teamService.searchMembersJoin({ filter: { member_id: user.id } })

        if (userTeamMembership) {
            userTeamMembership.forEach(async (teamMembership: TeamMemberJoin) => {
                // For every team, retrieve the base object
                const team: Team = await teamService.getTeam({ filter: { _id: teamMembership.team_id } })

                // These are the specific roles built for that team
                const teamRoles: KysoRole[] = team.roles

                // For every role assigned to this user in this team, retrieve their permissions
                let computedPermissions = []
                teamMembership.role_names.map((element) => {
                    const existsRole: KysoRole[] = teamRoles.filter((y) => y.name === element)

                    // If the role exists, add all the permissions to the computedPermissionsArray
                    if (existsRole) {
                        computedPermissions = computedPermissions.concat(existsRole[0].permissions)
                    }
                })

                response.push({
                    team: team.name,
                    teamId: team.id,
                    permissions: [...new Set(computedPermissions)], // Remove duplicated permissions
                })
            })
        } // else --> The user has no specific role for the teams of the organization. Apply organization roles

        // Search for organizations in which the user is a member
        const userOrganizationMembership: OrganizationMemberJoin[] = await organizationService.searchMembersJoin({ filter: { member_id: user.id } })

        if (userOrganizationMembership) {
            userOrganizationMembership.forEach(async (organizationMembership: OrganizationMemberJoin) => {
                // For every organization, retrieve the base object
                let objectId = new mongo.ObjectId(organizationMembership.organization_id)
                const organization: Organization = await organizationService.getOrganization({ filter: { _id: objectId } })

                // These are the specific roles built for that team
                const organizationRoles: KysoRole[] = organization.roles

                // For every role assigned to this user in this organization, retrieve their permissions
                let computedPermissions = []

                organizationMembership.role_names.map((element) => {
                    const existsRole: KysoRole[] = organizationRoles.filter((y) => y.name === element)

                    // If the role exists, add all the permissions to the computedPermissionsArray
                    if (existsRole) {
                        computedPermissions = computedPermissions.concat(existsRole[0].permissions)
                    } else {
                        // If is not an organization role, could be a platform role
                        const existsPlatformRole: KysoRole[] = platformRoles.filter((y) => y.name === element)

                        if (existsPlatformRole) {
                            computedPermissions = computedPermissions.concat(existsPlatformRole[0].permissions)
                        } else {
                            Logger.warn(`Role ${element} does not exist in organization nor in platform roles`)
                        }
                    }
                })

                // Get all the teams that belong to that organizations (an user can belong to multiple organizations)
                const organizationTeams: Team[] = await teamService.getTeams({ filter: { _organization_id: organization.id } })

                // For-each team
                organizationTeams.forEach((orgTeam) => {
                    // If already exists in the response object, ignore it (team permissions override organization permissions)
                    const alreadyExistsInResponse = response.filter((x) => x.teamId === orgTeam.id)

                    if (!alreadyExistsInResponse) {
                        // If not, retrieve the roles
                        response.push({
                            team: orgTeam.name,
                            teamId: orgTeam.id,
                            permissions: [...new Set(computedPermissions)], // Remove duplicated permissions
                        })
                    }
                })
            })
        }

        return response
    }

    async login(password: string, provider: LoginProvider, username?: string): Promise<String> {
        switch (provider) {
            case LoginProvider.KYSO:
            default:
                return await this.kysoLoginProvider.login(password, username)
            case LoginProvider.GITHUB:
                return await this.githubLoginProvider.login(password)
            // case LoginProvider.GOOGLE:
        }
    }

    /**
     * Returns undefined if the token is invalid. Otherwise, return the decoded token
     *
     * @param token Token to evaluate and decode
     * @returns
     */
    evaluateAndDecodeToken(token: string): any {
        try {
            this.jwtService.verify(token)
            const decodedToken = this.jwtService.decode(token)

            return decodedToken
        } catch (ex) {
            // TOKEN IS NOT VALID
            return undefined
        }
    }
}
