import { CreateUserRequestDTO, Login, LoginProviderEnum, Token, UserAccount } from '@kyso-io/kyso-model'
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Autowired } from '../../../decorators/autowired'
import { UsersService } from '../../users/users.service'

export const TOKEN_EXPIRATION_TIME = '8h'

@Injectable()
export class PingIdLoginProvider {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    constructor(private readonly jwtService: JwtService) {}

    public async login(login: Login): Promise<string> {
        Logger.log(`User ${login.username} is trying to login with PingId`)

        try {
            let user = await this.usersService.getUser({
                filter: { username: login.username },
            })

            if (!user) {
                // New User
                const name = login.payload.name
                const portrait = login.payload.profilePicture
                Logger.log(`User ${login.username} is a new user`)
                const createUserRequestDto: CreateUserRequestDTO = new CreateUserRequestDTO(
                    login.username,
                    login.username,
                    name,
                    name,
                    LoginProviderEnum.PING_ID_SAML,
                    '',
                    '',
                    '',
                    'free',
                    portrait,
                    false,
                    [],
                    login.password,
                )
                user = await this.usersService.createUser(createUserRequestDto)
            }

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
            return this.jwtService.sign(
                { payload },
                {
                    expiresIn: TOKEN_EXPIRATION_TIME,
                    issuer: 'kyso',
                },
            )
        } catch (e) {
            console.log(e)
            throw new UnauthorizedException('Invalid credentials')
        }
    }
}
