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
import { BaseLoginProvider } from './base-login.provider'

@Injectable()
export class GitlabLoginProvider extends BaseLoginProvider {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    @Autowired({ typeName: 'GitlabReposService' })
    private gitlabReposService: GitlabReposService

    constructor(protected readonly jwtService: JwtService) {
        super(jwtService)
    }

    async login(login: Login): Promise<string> {
        try {
            const accessToken: GitlabAccessToken = await this.gitlabReposService.getAccessToken(login.password, login.payload)
            const gitlabUser: GitlabUser = await this.gitlabReposService.getUserByAccessToken(accessToken.access_token)

            // Get user's detail
            // Check if the user exists in database, and if not, create it
            let user: User = await this.usersService.getUser({
                filter: { email: gitlabUser.email },
            })
            if (!user) {
                // User does not exists, create it
                const createUserRequestDto: CreateUserRequestDTO = new CreateUserRequestDTO(
                    gitlabUser.email,
                    gitlabUser.username,
                    gitlabUser.name,
                    gitlabUser.name,
                    LoginProviderEnum.GITLAB,
                    '',
                    '',
                    '',
                    'free',
                    gitlabUser.avatar_url,
                    null,
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
                Logger.log(`User ${gitlabUser.email} is adding Gitlab account`, GitlabLoginProvider.name)
            } else {
                user.accounts[index].accessToken = accessToken.access_token
                user.accounts[index].payload = accessToken
                Logger.log(`User ${gitlabUser.email} is updating Gitlab account`, GitlabLoginProvider.name)
            }
            await this.usersService.updateUser({ _id: new ObjectId(user.id) }, { $set: { accounts: user.accounts } })

            await this.addUserToOrganizationsAutomatically(user);

            return await this.createToken(user)
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
