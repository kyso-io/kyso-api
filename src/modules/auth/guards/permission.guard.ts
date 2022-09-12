import { HEADER_X_KYSO_ORGANIZATION, HEADER_X_KYSO_TEAM, Organization, Team, Token, TokenPermissions } from '@kyso-io/kyso-model'
import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Autowired } from '../../../decorators/autowired'
import { IS_PUBLIC_KEY } from '../../../decorators/is-public'
import { OrganizationsService } from '../../organizations/organizations.service'
import { TeamsService } from '../../teams/teams.service'
import { UsersService } from '../../users/users.service'
import { PERMISSION_KEY } from '../annotations/permission.decorator'
import { AuthService } from '../auth.service'
import { PlatformRoleService } from '../platform-role.service'
import { UserRoleService } from '../user-role.service'

@Injectable()
export class PermissionsGuard implements CanActivate {
    @Autowired({ typeName: 'AuthService' })
    private readonly authService: AuthService

    @Autowired({ typeName: 'UserRoleService' })
    public userRoleService: UserRoleService

    @Autowired({ typeName: 'PlatformRoleService' })
    public platformRoleService: PlatformRoleService

    @Autowired({ typeName: 'TeamsService' })
    public teamsService: TeamsService

    @Autowired({ typeName: 'UsersService' })
    public usersService: UsersService

    @Autowired({ typeName: 'OrganizationsService' })
    public organizationsService: OrganizationsService

    constructor(private readonly reflector: Reflector) {}

    async canActivate(context: ExecutionContext) {
        const isPublic: boolean = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])
        if (isPublic) {
            return true
        }

        try {
            const request = context.switchToHttp().getRequest()

            if (!request.headers.hasOwnProperty('authorization') || request.headers['authorization'] === null || request.headers['authorization'] === '') {
                return false
            }

            // Get the token
            const tokenPayload: Token = this.authService.evaluateAndDecodeTokenFromHeader(request.headers.authorization)
            if (!tokenPayload) {
                return false
            }

            // Get permissions of the requester user
            const permissions: TokenPermissions = await AuthService.buildFinalPermissionsForUser(
                tokenPayload.username,
                this.usersService,
                this.teamsService,
                this.organizationsService,
                this.platformRoleService,
                this.userRoleService,
            )

            tokenPayload.permissions = permissions

            // Set token in request to get access in controller
            request.token = tokenPayload

            const team = request.headers[HEADER_X_KYSO_TEAM]
            const organization = request.headers[HEADER_X_KYSO_ORGANIZATION]

            const organizationObject: Organization = await this.organizationsService.getOrganization({
                filter: {
                    sluglified_name: organization,
                },
            })

            let teamObject: Team = null;
            
            if(team) {
                teamObject = await this.teamsService.getUniqueTeam(organizationObject.id, team);
            } 

            const permissionToActivateEndpoint = this.reflector.getAllAndOverride<any>(PERMISSION_KEY, [context.getHandler(), context.getClass()])

            return AuthService.hasPermissions(
                tokenPayload, 
                permissionToActivateEndpoint, 
                teamObject ? teamObject.id : null, 
                organizationObject.id)
        } catch (ex) {
            Logger.error(`Error checking permissions`, ex)
            return false
        }
    }
}
