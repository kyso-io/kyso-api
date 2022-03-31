import { AddUserAccountDTO, CreateUserRequestDTO, Login, LoginProviderEnum, Token, User, UserAccount } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ObjectId } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { Autowired } from '../../../decorators/autowired'
import { GitlabReposService } from '../../gitlab-repos/gitlab-repos.service'
import { GitlabAccessToken } from '../../gitlab-repos/interfaces/gitlab-access-token'
import { GitlabUser } from '../../gitlab-repos/interfaces/gitlab-user'
import { UsersService } from '../../users/users.service'

export const TOKEN_EXPIRATION_TIME = '8h'

@Injectable()
export class GitlabLoginProvider {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    @Autowired({ typeName: 'GitlabReposService' })
    private gitlabReposService: GitlabReposService

    constructor(private readonly jwtService: JwtService) {}

    async login(login: Login): Promise<string> {
        try {
            const accessToken: GitlabAccessToken = await this.gitlabReposService.getAccessToken(login.password, login.payload)
            const gitlabUser: GitlabUser = await this.gitlabReposService.getUserByAccessToken(accessToken.access_token)
            login.username = gitlabUser.username

            // Get user's detail
            // Check if the user exists in database, and if not, create it
            let user: User = await this.usersService.getUser({
                filter: { username: login.username },
            })
            if (!user) {
                // User does not exists, create it
                const createUserRequestDto: CreateUserRequestDTO = new CreateUserRequestDTO(
                    gitlabUser.email,
                    login.username,
                    gitlabUser.name,
                    gitlabUser.name,
                    LoginProviderEnum.GITLAB,
                    '',
                    '',
                    '',
                    'free',
                    gitlabUser.avatar_url,
                    false,
                    [],
                    uuidv4(),
                )
                user = await this.usersService.createUser(createUserRequestDto)
            }

            const index: number = user.accounts.findIndex(
                (userAccount: UserAccount) => userAccount.type === LoginProviderEnum.GITLAB && userAccount.accountId === gitlabUser.id.toString(),
            )
            if (index === -1) {
                user.accounts.push({
                    type: LoginProviderEnum.GITLAB,
                    accountId: gitlabUser.id.toString(),
                    username: gitlabUser.username,
                    accessToken: accessToken.access_token,
                    payload: accessToken,
                })
                Logger.log(`User ${login.username} is adding Gitlab account`, GitlabLoginProvider.name)
            } else {
                user.accounts[index].accessToken = accessToken.access_token
                user.accounts[index].payload = accessToken
                Logger.log(`User ${login.username} is updating Gitlab account`, GitlabLoginProvider.name)
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
                user.email_verified,
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

    public async addUserAccount(token: Token, addUserAccount: AddUserAccountDTO): Promise<boolean> {
        try {
            const accessToken: GitlabAccessToken = await this.gitlabReposService.getAccessToken(addUserAccount.code)
            const gitlabUser: GitlabUser = await this.gitlabReposService.getUserByAccessToken(accessToken.access_token)

            const user: User = await this.usersService.getUserById(token.id)
            const index: number = user.accounts.findIndex(
                (userAccount: UserAccount) => userAccount.type === LoginProviderEnum.GITLAB && userAccount.accountId === gitlabUser.id.toString(),
            )
            if (index === -1) {
                user.accounts.push({
                    type: LoginProviderEnum.GITLAB,
                    accountId: gitlabUser.id.toString(),
                    username: gitlabUser.username,
                    accessToken: accessToken.access_token,
                    payload: accessToken,
                })
                Logger.log(`User ${user.username} is adding Gitlab account`, GitlabLoginProvider.name)
            } else {
                user.accounts[index].accessToken = accessToken.access_token
                user.accounts[index].payload = accessToken
                Logger.log(`User ${user.username} is updating Gitlab account`, GitlabLoginProvider.name)
            }
            await this.usersService.updateUser({ _id: new ObjectId(user.id) }, { $set: { accounts: user.accounts } })
            return true
        } catch (e) {
            console.log(e)
            return false
        }
    }
}
