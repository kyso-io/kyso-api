import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { HEADER_X_KYSO_TEAM, HEADER_X_KYSO_ORGANIZATION } from '../../../model/constants'
import { ResourcePermissions } from '../../../model/resource-permissions.model'
import { Token } from '../../../model/token.model'
import { GlobalPermissionsEnum } from '../../../security/general-permissions.enum'
import { PERMISSION_KEY } from '../annotations/permission.decorator'
import { AuthService } from '../auth.service'

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(private readonly reflector: Reflector, private readonly authService: AuthService) {}

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        try {
            const request = context.switchToHttp().getRequest()

            // Get the token
            const tokenPayload: Token = this.authService.evaluateAndDecodeTokenFromHeader(request.headers.authorization)

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
                    userPermissionsInThatTeam = tokenPayload.permissions.teams.find((x) => x.name === team)
                }

                // Check if user has the required permissions in the organization
                let userPermissionsInThatOrganization: ResourcePermissions
                if (organization) {
                    userPermissionsInThatOrganization = tokenPayload.permissions.organizations.find((x) => x.name === organization)
                }

                // Finally, check the global permissions
                const userGlobalPermissions = tokenPayload.permissions.global

                let allUserPermissions = []

                if (userPermissionsInThatTeam) {
                    if(userPermissionsInThatTeam.organization_inherited === false && userPermissionsInThatTeam.permissions) {
                        allUserPermissions = [...userPermissionsInThatTeam.permissions]
                    } else {
                        // Inherit permissions from organization
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
                    return false
                }
            }
        } catch (ex) {
            Logger.error(`Error checking permissions`, ex)
            return false
        }
    }
}
