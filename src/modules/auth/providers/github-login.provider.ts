import { CreateUserRequestDTO, Login, LoginProviderEnum, Token, TokenPermissions, User, UserAccount } from '@kyso-io/kyso-model'
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import axios from 'axios'
import { ObjectId } from 'mongodb'
import { Autowired } from '../../../decorators/autowired'
import { UnauthorizedError } from '../../../helpers/errorHandling'
import { GithubReposService } from '../../github-repos/github-repos.service'
import { OrganizationsService } from '../../organizations/organizations.service'
import { TeamsService } from '../../teams/teams.service'
import { UsersService } from '../../users/users.service'
import { AuthService } from '../auth.service'
import { GoogleLoginProvider } from './google-login.provider'
import { PlatformRoleMongoProvider } from './mongo-platform-role.provider'
import { UserRoleMongoProvider } from './mongo-user-role.provider'

export const TOKEN_EXPIRATION_TIME = '8h'

@Injectable()
export class GithubLoginProvider {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    @Autowired({ typeName: 'OrganizationsService' })
    private organizationsService: OrganizationsService

    @Autowired({ typeName: 'TeamsService' })
    private teamsService: TeamsService

    @Autowired({ typeName: 'GithubReposService' })
    private githubReposService: GithubReposService

    constructor(
        private readonly platformRoleProvider: PlatformRoleMongoProvider,
        private readonly jwtService: JwtService,
        private readonly userRoleProvider: UserRoleMongoProvider,
    ) {}
    // FLOW:
    //     * After calling login, frontend should call to
    // https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_url=${REDIRECT}&state=${RANDOM_STRING}
    //       to get a temporary code
    //     * Then, frontend should call this method throught the API to get the final JWT
    //     * Finally, should use this JWT for the rest of the methods
    //     * The access_token will be stored in MongoDB, so the next operations could be managed as well
    async login(login: Login): Promise<string> {
        try {
            const res = await axios.post(
                `https://github.com/login/oauth/access_token`,
                {
                    client_id: process.env.AUTH_GITHUB_CLIENT_ID,
                    client_secret: process.env.AUTH_GITHUB_CLIENT_SECRET,
                    code: login.password,
                },
                {
                    headers: { 'content-type': 'application/json' },
                },
            )
            if (res.data.includes('error_description')) {
                // We got an error. Thanks Github for returning an error as a 200 ;)
                Logger.error(`Error getting access_token: ${res.data}`)
                throw new UnauthorizedError('')
            }

            // Retrieve the token...
            const accessToken = res.data.split('&')[0].split('=')[1]
            const githubUser = await this.githubReposService.getUserByAccessToken(accessToken)

            // Get user's detail
            // Check if the user exists in database, and if not, create it
            let user: User = await this.usersService.getUser({
                filter: { username: login.username },
            })
            if (!user) {
                // User does not exists, create it
                const createUserRequestDto: CreateUserRequestDTO = new CreateUserRequestDTO(
                    login.username,
                    login.username,
                    githubUser.name,
                    githubUser.login,
                    LoginProviderEnum.GITHUB,
                    '',
                    '',
                    '',
                    'free',
                    githubUser.avatar_url,
                    true,
                    [],
                    '',
                )
                user = await this.usersService.createUser(createUserRequestDto)
            }

            const index: number = user.accounts.findIndex(
                (userAccount: UserAccount) => userAccount.type === LoginProviderEnum.GITHUB && userAccount.accountId === githubUser.id,
            )
            if (index === -1) {
                user.accounts.push({
                    type: LoginProviderEnum.GITHUB,
                    accountId: githubUser.id,
                    username: githubUser.login,
                    accessToken,
                    payload: null,
                })
                Logger.log(`User ${login.username} is adding Google account`, GoogleLoginProvider.name)
            } else {
                user.accounts[index].accessToken = accessToken
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
            return null
        }
    }
}
