import { KysoUserAccessToken, Token, UserAccount } from '@kyso-io/kyso-model'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Autowired } from '../../../decorators/autowired'
import { UsersService } from '../../users/users.service'
import { AuthService, TOKEN_EXPIRATION_TIME } from '../auth.service'

@Injectable()
export class KysoLoginProvider {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    constructor(private readonly jwtService: JwtService) {}

    async login(password: string, username?: string): Promise<string> {
        // Get user from database
        const user = await this.usersService.getUser({
            filter: { email: username },
        })

        if (!user) {
            throw new UnauthorizedException('User not registered')
        }

        const isRightPassword = await AuthService.isPasswordCorrect(password, user.hashed_password)

        if (isRightPassword) {
            const payload: Token = new Token(
                user.id.toString(),
                user.name,
                user.username,
                user.display_name,
                user.email,
                user.plan,
                user.avatar_url,
                user.location,
                user.link,
                user.bio,
                user.accounts.map((userAccount: UserAccount) => ({
                    type: userAccount.type,
                    accountId: userAccount.accountId,
                    username: userAccount.username,
                })),
            )

            // generate token
            const token = this.jwtService.sign(
                { payload },
                {
                    expiresIn: TOKEN_EXPIRATION_TIME,
                    issuer: 'kyso',
                },
            )

            return token
        } else {
            throw new UnauthorizedException('Incorrect username or password')
        }
    }

    async loginWithAccessToken(access_token: string, username?: string): Promise<string> {
        // Get user from database
        const user = await this.usersService.getUser({
            filter: { username: username },
        })

        if (!user) {
            throw new UnauthorizedException('User not registered')
        }

        // Search for provided access_token for that user
        const dbAccessToken: KysoUserAccessToken = await this.usersService.searchAccessToken(user.id, access_token)

        if (!dbAccessToken) {
            throw new UnauthorizedException('Incorrect username or token')
        } else {
            const payload: Token = new Token(
                user.id.toString(),
                user.name,
                user.username,
                user.display_name,
                user.email,
                user.plan,
                user.avatar_url,
                user.location,
                user.link,
                user.bio,
                user.accounts.map((userAccount: UserAccount) => ({
                    type: userAccount.type,
                    accountId: userAccount.accountId,
                    username: userAccount.username,
                })),
            )

            // generate token
            const token = this.jwtService.sign(
                { payload },
                {
                    expiresIn: TOKEN_EXPIRATION_TIME,
                    issuer: 'kyso',
                },
            )

            return token
        }
    }
}
