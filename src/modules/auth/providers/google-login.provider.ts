import { CreateUserRequestDTO, Login, LoginProviderEnum, Token, TokenPermissions, UserAccount } from '@kyso-io/kyso-model'
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { OAuth2Client } from 'google-auth-library'
import { ObjectId } from 'mongodb'
import { Autowired } from '../../../decorators/autowired'
import { OrganizationsService } from '../../organizations/organizations.service'
import { TeamsService } from '../../teams/teams.service'
import { UsersService } from '../../users/users.service'
import { AuthService } from '../auth.service'
import { PlatformRoleMongoProvider } from './mongo-platform-role.provider'
import { UserRoleMongoProvider } from './mongo-user-role.provider'

export const TOKEN_EXPIRATION_TIME = '8h'

@Injectable()
export class GoogleLoginProvider {
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
        Logger.log(`User ${login.username} is trying to login with Google`, GoogleLoginProvider.name)
        const oAuth2Client = new OAuth2Client(process.env.AUTH_GOOGLE_CLIENT_ID, process.env.AUTH_GOOGLE_CLIENT_SECRET)
        oAuth2Client.setCredentials(login.payload)
        try {
            Logger.log(`User ${login.username} verifying token...`, GoogleLoginProvider.name)
            // Verify the id_token, and access the claims.
            const loginTicket = await oAuth2Client.verifyIdToken({
                idToken: oAuth2Client.credentials.id_token,
                audience: process.env.AUTH_GOOGLE_CLIENT_ID,
            })
            if (login.username !== loginTicket.getPayload().email) {
                throw new UnauthorizedException(`User ${login.username} is trying to login with Google, but the email is different`)
            }
            let user = await this.usersService.getUser({
                filter: { username: login.username },
            })
            if (!user) {
                // New User
                let name = loginTicket.getPayload().name
                if (loginTicket.getPayload()?.family_name && loginTicket.getPayload().family_name.length > 0) {
                    name = `${loginTicket.getPayload().given_name} ${loginTicket.getPayload().family_name}`
                }
                Logger.log(`User ${login.username} is a new user`, GoogleLoginProvider.name)
                const createUserRequestDto: CreateUserRequestDTO = new CreateUserRequestDTO(
                    loginTicket.getPayload().email,
                    loginTicket.getPayload().email,
                    name,
                    loginTicket.getPayload().name,
                    LoginProviderEnum.GOOGLE,
                    '',
                    '',
                    '',
                    'free',
                    loginTicket.getPayload().picture,
                    true,
                    [],
                    login.payload.access_token,
                )
                user = await this.usersService.createUser(createUserRequestDto)
            }

            const index: number = user.accounts.findIndex(
                (userAccount: UserAccount) => userAccount.type === LoginProviderEnum.GOOGLE && userAccount.username === loginTicket.getPayload().email,
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
            await this.usersService.updateUser({ _id: new ObjectId(user.id) }, { $set: { accounts: user.accounts } })
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
