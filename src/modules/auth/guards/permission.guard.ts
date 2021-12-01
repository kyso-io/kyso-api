import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { PERMISSION_KEY } from '../annotations/permission.decorator'
import { AuthService } from '../auth.service'

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly authService: AuthService) {}

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const request = context.switchToHttp().getRequest()
        
        // Get the token
        const token = request.headers.authorization.split("Bearer ")[1]

        // Validate that the token is not compromised, checking its signature
        const tokenPayload = this.authService.evaluateAndDecodeToken(token)

        if(!tokenPayload) {
            return false
        }

        // Get the permissions from the token (we can trust it, as the signature is right)
        
        // Check that the permissions match

        const permissionToActivateEndpoint = this.reflector.getAllAndOverride<any>(PERMISSION_KEY, [context.getHandler(), context.getClass()])
        
        if (!permissionToActivateEndpoint) {
            return false
        }

        return true
    }

}
