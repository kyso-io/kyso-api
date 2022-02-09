import { GlobalPermissionsEnum, HEADER_X_KYSO_ORGANIZATION, HEADER_X_KYSO_TEAM, ResourcePermissions, Token } from '@kyso-io/kyso-model'
import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { Autowired } from '../../../decorators/autowired'
import { PERMISSION_KEY } from '../annotations/permission.decorator'
import { AuthService } from '../auth.service'

@Injectable()
export class PermissionsGuard implements CanActivate {
    @Autowired({ typeName: 'AuthService' })
    private readonly authService: AuthService

    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        // FOR JNJ DEMO, REMOVE LATER
        // return true
        
        try {
            const request = context.switchToHttp().getRequest()

            // Get the token
            const tokenPayload: Token = this.authService.evaluateAndDecodeTokenFromHeader(request.headers.authorization)

            // Set token in request to get access in controller
            request.token = tokenPayload

            const team = request.headers[HEADER_X_KYSO_TEAM]
            const organization = request.headers[HEADER_X_KYSO_ORGANIZATION]

            // Validate that the token is not compromised
            if (!tokenPayload) {
                return false
            }

            const isGlobalAdmin = tokenPayload.permissions.global.find((x) => x === GlobalPermissionsEnum.GLOBAL_ADMIN)

            // triple absurd checking because a GLOBAL ADMIN DESERVES IT
            if (isGlobalAdmin) {
                return true
            }

            // Get the permissions from the token (we can trust it, as the signature is right)

            // Check that the permissions match

            const permissionToActivateEndpoint = this.reflector.getAllAndOverride<any>(PERMISSION_KEY, [context.getHandler(), context.getClass()])

            if (!permissionToActivateEndpoint) {
                // If there are no permissions means that is open to authenticated users
                return true
            } else {
                // Check if user has the required permissions in the team
                let userPermissionsInThatTeam: ResourcePermissions
                if (team) {
                    userPermissionsInThatTeam = tokenPayload.permissions.teams.find((x) => x.name.toLowerCase() === team.toLowerCase())
                }

                // Check if user has the required permissions in the organization
                let userPermissionsInThatOrganization: ResourcePermissions
                if (organization) {
                    userPermissionsInThatOrganization = tokenPayload.permissions.organizations.find((x) => x.name.toLowerCase() === organization.toLowerCase())
                }

                // Finally, check the global permissions
                const userGlobalPermissions = tokenPayload.permissions.global

                let allUserPermissions = []

                if (userPermissionsInThatTeam && userPermissionsInThatTeam?.permissions && userPermissionsInThatTeam.permissions.length > 0) {
                    /** makes no sense, if has organization_inherited, don't have permissions property */
                    // if (!userPermissionsInThatTeam.hasOwnProperty('organization_inherited') || userPermissionsInThatTeam.organization_inherited === false) {
                    allUserPermissions = [...userPermissionsInThatTeam.permissions]
                    //}
                } else {
                    if (userPermissionsInThatTeam && userPermissionsInThatTeam.organization_inherited) {
                        // TODO: get organization role of that user and retrieve their permissions
                        allUserPermissions = [...userPermissionsInThatOrganization.permissions]
                    }
                }

                if (userPermissionsInThatOrganization) {
                    allUserPermissions = [...allUserPermissions, ...userPermissionsInThatOrganization.permissions]
                }

                if (userGlobalPermissions) {
                    allUserPermissions = [...allUserPermissions, ...userGlobalPermissions]
                }

                const hasAllThePermissions = permissionToActivateEndpoint.every((i) => allUserPermissions.includes(i))

                if (hasAllThePermissions) {
                    return true
                } else {
                    Logger.log(`User ${tokenPayload.username} has no permissions`)
                    return false
                }
            }
        } catch (ex) {
            Logger.error(`Error checking permissions`, ex)
            return false
        }
    }
}
