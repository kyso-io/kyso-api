import { forwardRef, Inject, Injectable } from '@nestjs/common'
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

@Injectable()
export class AuthService {
    constructor(
        private readonly kysoLoginProvider: KysoLoginProvider, 
        private readonly githubLoginProvider: GithubLoginProvider,
        private readonly platformRoleProvider: PlatformRoleMongoProvider,
        private readonly teamService: TeamsService,
        private readonly organizationService: OrganizationsService,
        @Inject(forwardRef(() => UsersService))
        private readonly userService: UsersService,
        private readonly jwtService: JwtService) {}

    async getPlatformRoles(): Promise<KysoRole[]> {
        return this.platformRoleProvider.read({})
    }

    async buildFinalPermissionsForUser(username: string) {
        let response = [
            /*
            {
                team: "TeamName",
                teamId: "TeamId",
                permissions: []
            }
            */
        ]
        // Retrieve user object
        const user: User = await this.userService.getUser({ filter: { username: username }})

        // These are the generic platform roles in Kyso, can't be deleted. Are eternal.
        const platformRoles: KysoRole[] = await this.getPlatformRoles();

        // Search for teams in which this user is a member
        const userTeamMembership: TeamMemberJoin[] = await this.teamService.searchMembersJoin({filter: { member_id: user.id }})

        if(userTeamMembership) {
            userTeamMembership.forEach(async (teamMembership: TeamMemberJoin) => {
                // For every team, retrieve the base object
                const team: Team = await this.teamService.getTeam({ filter: { _id: teamMembership.team_id } })

                // These are the specific roles built for that team
                const teamRoles: KysoRole[] = team.roles;

                // For every role assigned to this user in this team, retrieve their permissions
                let computedPermissions = []
                teamMembership.role_names.map(element => {
                    const existsRole: KysoRole[] = teamRoles.filter(y => y.name === element)
                    
                    // If the role exists, add all the permissions to the computedPermissionsArray
                    if(existsRole) {
                        computedPermissions = computedPermissions.concat(existsRole[0].permissions)
                    }
                });

                response.push({
                    team: team.name,
                    teamId: team.id,
                    permissions: [...new Set(computedPermissions)] // Remove duplicated permissions
                })
            });
        } // else --> The user has no specific role for the teams of the organization. Apply organization roles

        // Search for organizations in which the user is a member
        const userOrganizationMembership: OrganizationMemberJoin[] = await this.organizationService.searchMembersJoin({filter: { member_id: user.id }})

        if(userOrganizationMembership) {
            userOrganizationMembership.forEach(async (organizationMembership: OrganizationMemberJoin) => {
                // For every organization, retrieve the base object
                const organization: Organization = await this.organizationService.getOrganization({ filter: { _id: organizationMembership.organization_id } })

                // These are the specific roles built for that team
                const organizationRoles: KysoRole[] = organization.roles

                // For every role assigned to this user in this organization, retrieve their permissions
                let computedPermissions = []

                organizationMembership.role_names.map(element => {
                    const existsRole: KysoRole[] = organizationRoles.filter(y => y.name === element)
                    
                    // If the role exists, add all the permissions to the computedPermissionsArray
                    if(existsRole) {
                        computedPermissions = computedPermissions.concat(existsRole[0].permissions)
                    }
                });

                // Get all the teams that belong to that organizations (an user can belong to multiple organizations)
                const organizationTeams: Team[] = await this.teamService.getTeam({ filter: { _organization_id: organization.id }})

                // For-each team
                organizationTeams.forEach(orgTeam => {
                    // If already exists in the response object, ignore it (team permissions override organization permissions)
                    const alreadyExistsInResponse = response.filter(x => x.teamId === orgTeam.id)

                    if(!alreadyExistsInResponse) {
                        // If not, retrieve the roles
                        response.push({
                            team: orgTeam.name,
                            teamId: orgTeam.id,
                            permissions: [...new Set(computedPermissions)] // Remove duplicated permissions
                        })
                    }
                    
                });
            });
        } 
        

        /*
        const team: Team = await this.getTeam({ filter: { name: teamName } })
                
        if(team) {
            // Get all the members of this team
            const members: TeamMemberJoin[] = await this.teamMemberProvider.getTeamMembers(team.id);

            // These are the specific roles built for that team
            const teamRoles: KysoRole[] = team.roles;

            // And these are the generic platform roles in Kyso
            const platformRoles: KysoRole[] = await this.authService.getPlatformRoles();
            
            // Build query object to retrieve all the users
            const user_ids = members.map( (x: TeamMemberJoin) => {
                return x.member_id
            })
            
            // Build the query to retrieve all the users
            let filterArray = [];
            user_ids.forEach((id: string) => {
                filterArray.push({ "_id": id })
            })

            let filter = { filter: { "$or": filterArray }}

            let users = await this.usersService.getUsers(filter);

            let usersAndRoles = users.map( (u: User) => {
                // Find role for this user in members
                const thisMember: TeamMember = members.find((tm: TeamMember) => u.id === tm.member_id);
                return { ...u, roles: thisMember.role_names }
            })

            // Map roles with permissions
            const response = usersAndRoles.map( (uAndR: any) => {
                let allUserPermissionsInTeam = []
                
                // For every role for that user, search in  platform roles first, and in this team later for the related permissions
                uAndR.roles.forEach(element => {
                    // Is a platform role?
                    const platformRoleDefinition: KysoRole = platformRoles.find(x => x.name === element)
                    
                    if(platformRoleDefinition) {
                        allUserPermissionsInTeam = allUserPermissionsInTeam.concat(platformRoleDefinition.permissions)
                    } else {
                        // Is not a platform role, let's search in specific team roles
                        const roleDefinition: KysoRole = teamRoles.find(x => x.name === element)

                        if(roleDefinition) {
                            allUserPermissionsInTeam = allUserPermissionsInTeam.concat(roleDefinition.permissions)                      
                        } else {
                            Logger.warn(`The role ${element} does not exist in team ${team.name}`);
                        }
                    }
                });

                // Return unique values
                return { ...uAndR, permissions: [...new Set(allUserPermissionsInTeam)] }
            })

            return response
        } else {
            return []
        }        
        */
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
            const decodedToken = this.jwtService.decode(token);

            return decodedToken;
        } catch(ex) {
            // TOKEN IS NOT VALID
            return undefined
        }
    }
}
