import { Injectable, Logger } from '@nestjs/common'
import { KysoLoginProvider } from './providers/kyso-login.provider'
import { LoginProviderEnum } from '../../model/enum/login-provider.enum'
import { GithubLoginProvider } from './providers/github-login.provider'
import { JwtService } from '@nestjs/jwt'
import { PlatformRoleMongoProvider } from './providers/mongo-platform-role.provider'
import { KysoRole } from '../../model/kyso-role.model'
import { TeamsService } from '../teams/teams.service'
import { UsersService } from '../users/users.service'
import { User } from 'src/model/user.model'
import { TeamMemberJoin } from '../teams/model/team-member-join.model'
import { OrganizationsService } from '../organizations/organizations.service'
import { OrganizationMemberJoin } from '../organizations/model/organization-member-join.model'
import { Team } from 'src/model/team.model'
import { Organization } from 'src/model/organization.model'
import * as mongo from 'mongodb'
import * as bcrypt from 'bcryptjs'
import { UserRoleMongoProvider } from './providers/mongo-user-role.provider'
import { TokenPermissions } from 'src/model/token-permissions.model'
import { Token } from 'src/model/token.model'

@Injectable()
export class AuthService {
    constructor(
        private readonly kysoLoginProvider: KysoLoginProvider,
        private readonly githubLoginProvider: GithubLoginProvider,
        private readonly platformRoleProvider: PlatformRoleMongoProvider,
        private readonly jwtService: JwtService,
    ) {}

    static hashPassword(plainPassword: string): string {
        return bcrypt.hashSync(plainPassword)
    }

    /**
     * Checks if provided plain text password matches with provided hashed password
     * @param passwordToCheck Password to check in plain text
     * @param hashedPassword Password hashed
     * @returns true if both are equals, false in otger case
     */
    static async isPasswordCorrect(passwordToCheck, hashedPassword): Promise<boolean> {
        return await bcrypt.compare(passwordToCheck, hashedPassword)
    }

    async getPlatformRoles(): Promise<KysoRole[]> {
        return this.platformRoleProvider.read({})
    }

    static async buildFinalPermissionsForUser(
        username: string,
        userService: UsersService,
        teamService: TeamsService,
        organizationService: OrganizationsService,
        platformRoleProvider: PlatformRoleMongoProvider,
        userRoleProvider: UserRoleMongoProvider,
    ): Promise<TokenPermissions> {
        let response = {
            global: [],
            teams: [],
            organizations: [],
        } as TokenPermissions

        // Retrieve user object
        const user: User = await userService.getUser({ filter: { username: username } })

        // These are the generic platform roles in Kyso, can't be deleted. Are eternal.
        const platformRoles: KysoRole[] = await platformRoleProvider.read({})

        // Search for teams in which this user is a member
        const userTeamMembership: TeamMemberJoin[] = await teamService.searchMembers({ filter: { member_id: user.id } })

        if (userTeamMembership) {
            userTeamMembership.forEach(async (teamMembership: TeamMemberJoin) => {
                // For every team, retrieve the base object
                const team: Team = await teamService.getTeam({ filter: { _id: teamMembership.team_id } })

                // These are the specific roles built for that team
                const teamRoles: KysoRole[] = team.roles

                // For every role assigned to this user in this team, retrieve their permissions
                let computedPermissions = []
                teamMembership.role_names.map((element) => {
                    let existsRole: KysoRole[]
                    if (teamRoles) {
                        existsRole = teamRoles.filter((y) => y.name === element)
                    } else {
                        // No team roles, try to apply platform roles
                        existsRole = platformRoles.filter((y) => y.name === element)
                    }

                    // If the role exists, add all the permissions to the computedPermissionsArray
                    if (existsRole) {
                        computedPermissions = computedPermissions.concat(existsRole[0].permissions)
                    }
                })

                response.teams.push({
                    name: team.name,
                    id: team.id,
                    permissions: [...new Set(computedPermissions)], // Remove duplicated permissions
                })
            })
        }

        // Then, search for organization roles
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
                    let existsRole: KysoRole[]

                    if (organizationRoles) {
                        existsRole = organizationRoles.filter((y) => y.name === element)
                    } else {
                        // If there are not specific organization roles, try with platform roles
                        existsRole = platformRoles.filter((y) => y.name === element)
                    }

                    // If the role exists, add all the permissions to the computedPermissionsArray
                    if (existsRole) {
                        computedPermissions = computedPermissions.concat(existsRole[0].permissions)
                    } else {
                        Logger.warn(`Role ${element} does not exist in organization nor in platform roles`)
                    }
                })

                // Get all the teams that belong to that organizations (an user can belong to multiple organizations)
                const organizationTeams: Team[] = await teamService.getTeams({ filter: { _organization_id: organization.id } })

                // For-each team
                organizationTeams.forEach((orgTeam) => {
                    // If already exists in the response object, ignore it (team permissions override organization permissions)
                    const alreadyExistsInResponse = response.teams.filter((x) => x.id === orgTeam.id)

                    if (!alreadyExistsInResponse) {
                        // If not, retrieve the roles
                        response.teams.push({
                            name: orgTeam.name,
                            id: orgTeam.id,
                            permissions: [...new Set(computedPermissions)], // Remove duplicated permissions
                        })
                    }
                })
            })
        }

        // TODO: Global permissions, not related to teams
        const generalRoles = await userRoleProvider.read({ filter: { userId: user.id } })

        if (generalRoles) {
            for (let organizationMembership of userOrganizationMembership) {
                // For every organization, retrieve the base object
                let objectId = new mongo.ObjectId(organizationMembership.organization_id)
                const organization: Organization = await organizationService.getOrganization({ filter: { _id: objectId } })

                // These are the specific roles built for that team
                const organizationRoles: KysoRole[] = organization.roles

                // For every role assigned to this user in this organization, retrieve their permissions
                let computedPermissions = []

                organizationMembership.role_names.map((element) => {
                    let existsRole: KysoRole[]

                    if (organizationRoles) {
                        existsRole = organizationRoles.filter((y) => y.name === element)
                    } else {
                        // If there are not specific organization roles, try with platform roles
                        existsRole = platformRoles.filter((y) => y.name === element)
                    }

                    // If the role exists, add all the permissions to the computedPermissionsArray
                    if (existsRole) {
                        computedPermissions = computedPermissions.concat(existsRole[0].permissions)
                    } else {
                        Logger.warn(`Role ${element} does not exist in organization nor in platform roles`)
                    }
                })

                response.global = [...new Set(computedPermissions)]
            }
        }

        return response
    }

    async login(password: string, provider: LoginProviderEnum, username?: string): Promise<String> {
        switch (provider) {
            case LoginProviderEnum.KYSO:
            default:
                return await this.kysoLoginProvider.login(password, username)
            case LoginProviderEnum.GITHUB:
                return await this.githubLoginProvider.login(password)
            // case LoginProvider.GOOGLE:
        }
    }

    evaluateAndDecodeTokenFromHeader(authorizationHeader: string): Token {
        try {
            const token = authorizationHeader.split('Bearer ')[1]

            return this.evaluateAndDecodeToken(token)
        } catch (ex) {
            // TOKEN IS NOT VALID
            return undefined
        }
    }

    /**
     * Returns undefined if the token is invalid. Otherwise, return the decoded token
     *
     * @param token Token to evaluate and decode
     * @returns
     */
    evaluateAndDecodeToken(token: string): Token {
        try {
            this.jwtService.verify(token)
            const decodedToken = this.jwtService.decode(token)

            return decodedToken as Token
        } catch (ex) {
            // TOKEN IS NOT VALID
            return undefined
        }
    }
}
