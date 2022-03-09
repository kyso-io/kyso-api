import { CreateUserRequestDTO, Login, LoginProviderEnum, Token, User, UserAccount } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import axios from 'axios'
import { ObjectId } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { Autowired } from '../../../decorators/autowired'
import { UnauthorizedError } from '../../../helpers/errorHandling'
import { GithubReposService } from '../../github-repos/github-repos.service'
import { KysoSettingsEnum } from '../../kyso-settings/enums/kyso-settings.enum'
import { KysoSettingsService } from '../../kyso-settings/kyso-settings.service'
import { UsersService } from '../../users/users.service'
import { GoogleLoginProvider } from './google-login.provider'

export const TOKEN_EXPIRATION_TIME = '8h'

@Injectable()
export class GithubLoginProvider {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    @Autowired({ typeName: 'GithubReposService' })
    private githubReposService: GithubReposService

    @Autowired({ typeName: 'KysoSettingsService' })
    private kysoSettingsService: KysoSettingsService

    constructor(private readonly jwtService: JwtService) {}
    // FLOW:
    //     * After calling login, frontend should call to
    // https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_url=${REDIRECT}&state=${RANDOM_STRING}
    //       to get a temporary code
    //     * Then, frontend should call this method throught the API to get the final JWT
    //     * Finally, should use this JWT for the rest of the methods
    //     * The access_token will be stored in MongoDB, so the next operations could be managed as well
    async login(login: Login): Promise<string> {
        try {
            const clientId = await this.kysoSettingsService.getValue(KysoSettingsEnum.AUTH_GITHUB_CLIENT_ID)
            const clientSecret = await this.kysoSettingsService.getValue(KysoSettingsEnum.AUTH_GITHUB_CLIENT_SECRET)

            const res = await axios.post(
                `https://github.com/login/oauth/access_token`,
                {
                    client_id: clientId,
                    client_secret: clientSecret,
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
            login.username = githubUser.login

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
                    uuidv4(),
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
            return null
        }
    }
}
