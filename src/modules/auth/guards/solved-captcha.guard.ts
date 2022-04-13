import { Token, User } from '@kyso-io/kyso-model'
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Autowired } from '../../../decorators/autowired'
import { UsersService } from '../../users/users.service'
import { AuthService } from '../auth.service'

@Injectable()
export class SolvedCaptchaGuard implements CanActivate {
    @Autowired({ typeName: 'AuthService' })
    private readonly authService: AuthService

    @Autowired({ typeName: 'UsersService' })
    private readonly usersService: UsersService

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest()
        if (!request.headers.hasOwnProperty('authorization') || request.headers['authorization'] === null || request.headers['authorization'] === '') {
            throw new ForbiddenException('Missing authorization header')
        }
        const tokenPayload: Token = this.authService.evaluateAndDecodeTokenFromHeader(request.headers.authorization)
        if (!tokenPayload) {
            throw new ForbiddenException('Invalid jwt token')
        }
        const user: User = await this.usersService.getUserById(tokenPayload.id)
        if (!user) {
            throw new ForbiddenException('User not found with this jwt token')
        }
        if (user.show_captcha) {
            throw new ForbiddenException('Captcha not solved')
        }
        return true
    }
}
