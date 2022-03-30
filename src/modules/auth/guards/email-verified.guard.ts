import { Token, User } from '@kyso-io/kyso-model'
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Autowired } from '../../../decorators/autowired'
import { UsersService } from '../../users/users.service'
import { AuthService } from '../auth.service'

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
    @Autowired({ typeName: 'AuthService' })
    private readonly authService: AuthService

    @Autowired({ typeName: 'UsersService' })
    private readonly usersService: UsersService

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest()
        if (!request.headers.hasOwnProperty('authorization') || request.headers['authorization'] === null || request.headers['authorization'] === '') {
            throw new ForbiddenException('Email not verified')
        }
        const tokenPayload: Token = this.authService.evaluateAndDecodeTokenFromHeader(request.headers.authorization)
        if (!tokenPayload) {
            throw new ForbiddenException('Email not verified')
        }
        const user: User = await this.usersService.getUserById(tokenPayload.id)
        if (!user) {
            throw new ForbiddenException('Email not verified')
        }
        if (!user.email_verified) {
            throw new ForbiddenException('Email not verified')
        }
        return true
    }
}
