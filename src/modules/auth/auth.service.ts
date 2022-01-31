import { KysoRole, LoginProviderEnum, Organization, OrganizationMemberJoin, Team, TeamMemberJoin, Token, TokenPermissions, User } from '@kyso-io/kyso-model'
import { Injectable, Logger, Provider } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import * as mongo from 'mongodb'
import { AutowiredService } from '../../generic/autowired.generic'
import { KysoPermissions } from '../../security/general-permissions.enum'
import { OrganizationsService } from '../organizations/organizations.service'
import { TeamsService } from '../teams/teams.service'
import { UsersService } from '../users/users.service'
import { GithubLoginProvider } from './providers/github-login.provider'
import { KysoLoginProvider } from './providers/kyso-login.provider'
import { PlatformRoleMongoProvider } from './providers/mongo-platform-role.provider'
import { UserRoleMongoProvider } from './providers/mongo-user-role.provider'

function factory(service: AuthService) {
    return service
}

export function createProvider(): Provider<AuthService> {
    return {
        provide: `${AuthService.name}`,
        useFactory: (service) => factory(service),
        inject: [AuthService],
    }
}

@Injectable()
export class AuthService extends AutowiredService {
    constructor(
        private readonly kysoLoginProvider: KysoLoginProvider,
        private readonly githubLoginProvider: GithubLoginProvider,
        private readonly platformRoleProvider: PlatformRoleMongoProvider,
        private readonly jwtService: JwtService,
    ) {
        super()
    }

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
        const response = {
            global: [],
            teams: [],
            organizations: [],
        } as TokenPermissions

        // Retrieve user object
        const user: User = await userService.getUser({ filter: { username: username } })

        response.global = user.global_permissions

        // These are the generic platform roles in Kyso, can't be deleted. Are eternal.
        const platformRoles: KysoRole[] = await platformRoleProvider.read({})

        // Search for teams in which this user is a member
        const userTeamMembership: TeamMemberJoin[] = await teamService.searchMembers({ filter: { member_id: user.id } })

        if (userTeamMembership && userTeamMembership.length > 0) {
            for (const teamMembership of userTeamMembership) {
                // For every team, retrieve the base object
                const team: Team = await teamService.getTeam({ filter: { _id: new mongo.ObjectId(teamMembership.team_id) } })

                // These are the specific roles built for that team
                const teamRoles: KysoRole[] = team.roles

                // For every role assigned to this user in this team, retrieve their permissions
                let computedPermissions: KysoPermissions[] = []

                teamMembership.role_names.map((element) => {
                    let existsRole: KysoRole[]

                    // Check if the role exists in platformRoles
                    existsRole = platformRoles.filter((y) => y.name === element)

                    if (teamRoles && teamRoles.length > 0) {
                         // If there are specific teamRoles, search for them as well
                        let existsCustomRole = teamRoles.filter((y) => y.name === element)

                        // If there are collision between platform role and organization role, the 
                        // organization role will prevail
                        if(existsCustomRole && existsCustomRole.length > 0) {
                            existsRole = existsCustomRole
                        }
                    }

                    // If the role exists, add all the permissions to the computedPermissionsArray
                    if (existsRole && existsRole.length > 0) {
                        computedPermissions = computedPermissions.concat(existsRole[0].permissions)
                    }
                })

                response.teams.push({
                    name: team.name,
                    nickname: team.nickname,
                    id: team.id,
                    permissions: [...new Set(computedPermissions)], // Remove duplicated permissions
                    organization_id: team.organization_id,
                })
            }
        }

        // Then, search for organization roles
        // Search for organizations in which the user is a member
        const userOrganizationMembership: OrganizationMemberJoin[] = await organizationService.searchMembersJoin({ filter: { member_id: user.id } })

        if (userOrganizationMembership && userOrganizationMembership.length > 0) {
            for (const organizationMembership of userOrganizationMembership) {
                // For every organization, retrieve the base object
                const objectId = new mongo.ObjectId(organizationMembership.organization_id)
                const organization: Organization = await organizationService.getOrganization({ filter: { _id: objectId } })

                // These are the specific roles built for that team
                const organizationRoles: KysoRole[] = organization.roles

                // For every role assigned to this user in this organization, retrieve their permissions
                let computedPermissions: KysoPermissions[] = []

                organizationMembership.role_names.map((element) => {
                    let existsRole: KysoRole[]

                    // Check if the role exists in platformRoles
                    existsRole = platformRoles.filter((y) => y.name === element)

                    if (organizationRoles && organizationRoles.length > 0) {
                        // If there are specific organizationRoles, search for them as well
                        let existsCustomRole = organizationRoles.filter((y) => y.name === element)

                        // If there are collision between platform role and organization role, the 
                        // organization role will prevail
                        if(existsCustomRole && existsCustomRole.length > 0) {
                            existsRole = existsCustomRole
                        }
                    }

                    // If the role exists, add all the permissions to the computedPermissionsArray
                    if (existsRole && existsRole.length > 0) {
                        computedPermissions = computedPermissions.concat(existsRole[0].permissions)
                    } else {
                        Logger.warn(`Role ${element} does not exist in organization nor in platform roles`)
                    }
                })

                response.organizations.push({
                    id: organization.id,
                    name: organization.name,
                    nickname: organization.nickname,
                    permissions: computedPermissions,
                })

                // Get all the teams that belong to that organizations (an user can belong to multiple organizations)
                const organizationTeams: Team[] = await teamService.getTeams({ filter: { organization_id: organization.id } })

                // For-each team
                for (const orgTeam of organizationTeams) {
                    // If already exists in the response object, ignore it (team permissions override organization permissions)
                    const alreadyExistsInResponse = response.teams.filter((x) => x.id === orgTeam.id)

                    // If not exists in response, then apply organization roles
                    if (alreadyExistsInResponse.length === 0) {
                        // If not, retrieve the roles
                        response.teams.push({
                            name: orgTeam.name,
                            nickname: orgTeam.nickname,
                            id: orgTeam.id,
                            organization_inherited: true,
                            organization_id: orgTeam.organization_id, // Remove duplicated permissions
                        })
                    }
                }
            }
        }

        // TODO: Global permissions, not related to teams
        const generalRoles = await userRoleProvider.read({ filter: { userId: user.id } })

        if (generalRoles && generalRoles.length > 0) {
            for (const organizationMembership of userOrganizationMembership) {
                // For every organization, retrieve the base object
                const objectId = new mongo.ObjectId(organizationMembership.organization_id)
                const organization: Organization = await organizationService.getOrganization({ filter: { _id: objectId } })

                // These are the specific roles built for that team
                const organizationRoles: KysoRole[] = organization.roles

                // For every role assigned to this user in this organization, retrieve their permissions
                let computedPermissions: KysoPermissions[] = []

                organizationMembership.role_names.map((element) => {
                    let existsRole: KysoRole[]

                    if (organizationRoles && organizationRoles.length > 0) {
                        existsRole = organizationRoles.filter((y) => y.name === element)
                    } else {
                        // If there are not specific organization roles, try with platform roles
                        existsRole = platformRoles.filter((y) => y.name === element)
                    }

                    // If the role exists, add all the permissions to the computedPermissionsArray
                    if (existsRole && existsRole.length > 0) {
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

    async login(password: string, provider: LoginProviderEnum, username?: string): Promise<string> {
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

            return (decodedToken as any).payload as Token
        } catch (ex) {
            // TOKEN IS NOT VALID
            return undefined
        }
    }
}
