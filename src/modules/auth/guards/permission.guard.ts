import { Injectable, CanActivate, ExecutionContext, Logger, forwardRef, Inject, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { HEADER_X_KYSO_ORGANIZATION, HEADER_X_KYSO_TEAM } from 'src/model/constants'
import { ResourcePermissions } from 'src/model/resource-permissions.model'
import { Token } from 'src/model/token.model'
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

                    /*
                    const hasAllThePermissions = userPermissionsInThatTeam.permissions.every((i) => permissionToActivateEndpoint.includes(i))

                    if (hasAllThePermissions) {
                        return true
                    } else {
                        return false
                    }
                    */
                }

                // Check if user has the required permissions in the organization
                let userPermissionsInThatOrganization: ResourcePermissions
                if (organization) {
                    userPermissionsInThatOrganization = tokenPayload.permissions.organizations.find((x) => x.name === organization)
                    /*
                    const hasAllThePermissions = userPermissionsInThatOrganization.permissions.every((i) => permissionToActivateEndpoint.includes(i))

                    if (hasAllThePermissions) {
                        return true
                    } else {
                        return false
                    }*/
                }

                // Finally, check the global permissions
                const userGlobalPermissions = tokenPayload.permissions.global

                let allUserPermissions = []

                if (userPermissionsInThatTeam) {
                    allUserPermissions = [...userPermissionsInThatTeam.permissions]
                }

                if (userPermissionsInThatOrganization) {
                    allUserPermissions = [...allUserPermissions, ...userPermissionsInThatOrganization.permissions]
                }

                if (userGlobalPermissions) {
                    allUserPermissions = [...allUserPermissions, ...userGlobalPermissions]
                }

                const hasAllThePermissions = allUserPermissions.every((i) => permissionToActivateEndpoint.includes(i))

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
