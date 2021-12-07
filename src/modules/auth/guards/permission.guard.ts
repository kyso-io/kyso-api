import { Injectable, CanActivate, ExecutionContext, Logger, forwardRef, Inject, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { PERMISSION_KEY } from '../annotations/permission.decorator'
import { AuthService } from '../auth.service'

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(private readonly reflector: Reflector, private readonly authService: AuthService) {}

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        try {
            const request = context.switchToHttp().getRequest()

            // Get the token
            const token = request.headers.authorization.split('Bearer ')[1]
            const team = request.headers['x-kyso-team']

            // Validate that the token is not compromised, checking its signature
            const tokenPayload = this.authService.evaluateAndDecodeToken(token)

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
                // Check if user has the required permissions
                if (team) {
                    const userPermissionsInThatTeam = tokenPayload.teams.find((x) => x.team === team)

                    const hasAllThePermissions = userPermissionsInThatTeam.permissions.every((i) => permissionToActivateEndpoint.includes(i))

                    if (hasAllThePermissions) {
                        return true
                    } else {
                        return false
                    }
                }
            }

            return true
        } catch (ex) {
            return false
        }
    }
}
