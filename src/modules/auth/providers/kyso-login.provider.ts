import { KysoUserAccessToken } from '@kyso-io/kyso-model'
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Autowired } from '../../../decorators/autowired'
import { UsersService } from '../../users/users.service'
import { AuthService } from '../auth.service'
import { BaseLoginProvider } from './base-login.provider'

@Injectable()
export class KysoLoginProvider extends BaseLoginProvider {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    constructor(protected readonly jwtService: JwtService) {
        super(jwtService)
    }

    async login(password: string, username?: string): Promise<string> {
        if (!password) {
            throw new BadRequestException('Password is required')
        }
        // Get user from database
        const user = await this.usersService.getUser({
            filter: { email: username.toLowerCase() },
        })

        if (!user) {
            throw new UnauthorizedException('User does not exist')
        }

        const isRightPassword = await AuthService.isPasswordCorrect(password, user.hashed_password)

        if (isRightPassword) {
            return await this.createToken(user)
        } else {
            throw new UnauthorizedException('Invalid credentials')
        }
    }

    async loginWithAccessToken(access_token: string, username: string): Promise<string> {
        if (!access_token) {
            throw new BadRequestException('Access token is required')
        }
        // Get user from database
        const user = await this.usersService.getUser({
            filter: { email: username.toLowerCase() },
        })
        if (!user) {
            throw new UnauthorizedException('User does not exist')
        }

        // Search for provided access_token for that user
        const dbAccessToken: KysoUserAccessToken = await this.usersService.searchAccessToken(user.id, access_token)
        if (!dbAccessToken) {
            throw new UnauthorizedException('Invalid credentials')
        } else {
            return await this.createToken(user)
        }
    }
}
