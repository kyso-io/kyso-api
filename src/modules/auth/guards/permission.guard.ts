import { GlobalPermissionsEnum, HEADER_X_KYSO_ORGANIZATION, HEADER_X_KYSO_TEAM, ResourcePermissions, Token, TokenPermissions } from '@kyso-io/kyso-model'
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

            // Get the token
            const tokenPayload: Token = this.authService.evaluateAndDecodeTokenFromHeader(request.headers.authorization)

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

            const permissionToActivateEndpoint = this.reflector.getAllAndOverride<any>(PERMISSION_KEY, [context.getHandler(), context.getClass()])

            return await AuthService.hasPermissions(tokenPayload, permissionToActivateEndpoint, team, organization)
        } catch (ex) {
            Logger.error(`Error checking permissions`, ex)
            return false
        }
    }
}
