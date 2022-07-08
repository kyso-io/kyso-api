import { AddUserAccountDTO, AddUserOrganizationDto, CreateUserRequestDTO, GithubEmail, KysoRole, KysoSettingsEnum, Login, LoginProviderEnum, Organization, Token, User, UserAccount } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import axios from 'axios'
import { ObjectId } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { Autowired } from '../../../decorators/autowired'
import { UnauthorizedError } from '../../../helpers/errorHandling'
import { GithubReposService } from '../../github-repos/github-repos.service'
import { UsersService } from '../../users/users.service'
import { BaseLoginProvider } from './base-login.provider'

@Injectable()
export class GithubLoginProvider extends BaseLoginProvider {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService
    
    @Autowired({ typeName: 'GithubReposService' })
    private githubReposService: GithubReposService

    constructor(protected readonly jwtService: JwtService) {
        super(jwtService)
    }

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
            const mails: GithubEmail[] = await this.githubReposService.getEmailsByAccessToken(accessToken)
            let githubEmail: GithubEmail | undefined = mails.find((mail: GithubEmail) => mail.primary)
            if (!githubEmail && mails.length > 0) {
                githubEmail = mails[0]
            }

            // Get user's detail
            // Check if the user exists in database, and if not, create it
            let user: User = await this.usersService.getUser({
                filter: { email: githubEmail.email },
            })
            if (!user) {
                // User does not exists, create it
                const createUserRequestDto: CreateUserRequestDTO = new CreateUserRequestDTO(
                    githubEmail.email,
                    githubUser.login,
                    githubUser.name,
                    githubUser.login,
                    LoginProviderEnum.GITHUB,
                    '',
                    '',
                    '',
                    'free',
                    githubUser.avatar_url,
                    false,
                    [],
                    uuidv4(),
                )
                user = await this.usersService.createUser(createUserRequestDto)

                await this.addUserToOrganizationsAutomatically(user)
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
                Logger.log(`User ${githubEmail.email} is adding Github account`, GithubLoginProvider.name)
            } else {
                user.accounts[index].accessToken = accessToken
                Logger.log(`User ${githubEmail.email} is updating Github account`, GithubLoginProvider.name)
            }
            await this.usersService.updateUser({ _id: new ObjectId(user.id) }, { $set: { accounts: user.accounts } })


            return await this.createToken(user);
        } catch (e) {
            console.log(e)
            return null
        }
    }

    public async addUserAccount(token: Token, addUserAccount: AddUserAccountDTO): Promise<boolean> {
        try {
            const clientId = await this.kysoSettingsService.getValue(KysoSettingsEnum.AUTH_GITHUB_CLIENT_ID)
            const clientSecret = await this.kysoSettingsService.getValue(KysoSettingsEnum.AUTH_GITHUB_CLIENT_SECRET)

            const res = await axios.post(
                `https://github.com/login/oauth/access_token`,
                {
                    client_id: clientId,
                    client_secret: clientSecret,
                    code: addUserAccount.code,
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
            const user: User = await this.usersService.getUserById(token.id)
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
                Logger.log(`User ${user.username} is adding Github account`, GithubLoginProvider.name)
            } else {
                user.accounts[index].accessToken = accessToken
                Logger.log(`User ${user.username} is updating Github account`, GithubLoginProvider.name)
            }
            await this.usersService.updateUser({ _id: new ObjectId(user.id) }, { $set: { accounts: user.accounts } })
            return true
        } catch (e) {
            console.log(e)
            return false
        }
    }
}
