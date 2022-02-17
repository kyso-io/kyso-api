import { CreateUserRequestDTO, Login, LoginProviderEnum, Token, TokenPermissions } from '@kyso-io/kyso-model'
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Autowired } from '../../../decorators/autowired'
import { OrganizationsService } from '../../organizations/organizations.service'
import { TeamsService } from '../../teams/teams.service'
import { UsersService } from '../../users/users.service'
import { AuthService } from '../auth.service'
import { PlatformRoleMongoProvider } from './mongo-platform-role.provider'
import { UserRoleMongoProvider } from './mongo-user-role.provider'

export const TOKEN_EXPIRATION_TIME = '8h'

@Injectable()
export class PingIdLoginProvider {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    @Autowired({ typeName: 'OrganizationsService' })
    private organizationsService: OrganizationsService

    @Autowired({ typeName: 'TeamsService' })
    private teamsService: TeamsService

    constructor(
        private readonly jwtService: JwtService,
        private readonly platformRoleProvider: PlatformRoleMongoProvider,
        private readonly userRoleProvider: UserRoleMongoProvider,
    ) {}

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
                    true,
                    [],
                    login.password,
                )
                user = await this.usersService.createUser(createUserRequestDto)
            }

            // Update
            /*const index: number = user.accounts.findIndex(
                (userAccount: UserAccount) => userAccount.type === LoginProviderEnum.PING_ID_SAML && userAccount.username === loginTicket.getPayload().email,
            )
            if (index === -1) {
                user.accounts.push({
                    type: LoginProviderEnum.GOOGLE,
                    accountId: loginTicket.getPayload().email,
                    username: loginTicket.getPayload().email,
                    accessToken: login.payload.access_token,
                    payload: login.payload,
                })
                Logger.log(`User ${login.username} is adding Google account`, GoogleLoginProvider.name)
            } else {
                user.accounts[index].accessToken = login.payload.access_token
                user.accounts[index].payload = login.payload
                Logger.log(`User ${login.username} is updating Google account`, GoogleLoginProvider.name)
            }
            await this.usersService.updateUser({ _id: new ObjectId(user.id) }, { $set: { accounts: user.accounts } })*/

            const permissions: TokenPermissions = await AuthService.buildFinalPermissionsForUser(
                login.username,
                this.usersService,
                this.teamsService,
                this.organizationsService,
                this.platformRoleProvider,
                this.userRoleProvider,
            )

            const payload: Token = new Token(
                user.id.toString(),
                user.name,
                user.username,
                user.nickname,
                user.email,
                user.plan,
                permissions,
                user.avatar_url,
                user.location,
                user.link,
                user.bio,
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
            throw new UnauthorizedException('Unauthorized')
        }
    }
}
