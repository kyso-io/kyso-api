import { CreateUserRequestDTO, Login, LoginProviderEnum, Token, User, UserAccount } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ObjectId } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { Autowired } from '../../../decorators/autowired'
import { BitbucketReposService } from '../../bitbucket-repos/bitbucket-repos.service'
import { UsersService } from '../../users/users.service'

export const TOKEN_EXPIRATION_TIME = '8h'

@Injectable()
export class BitbucketLoginProvider {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    @Autowired({ typeName: 'BitbucketReposService' })
    private bitbucketReposService: BitbucketReposService

    constructor(private readonly jwtService: JwtService) {}

    async login(login: Login): Promise<string> {
        try {
            const bitbucketLoginResponse = await this.bitbucketReposService.login(login.password)
            const accessToken: string = bitbucketLoginResponse.access_token
            const bitbucketUser: any = await this.bitbucketReposService.getUser(accessToken)
            // Get user's detail
            // Check if the user exists in database, and if not, create it
            let user: User = await this.usersService.getUser({
                filter: { username: bitbucketUser.username },
            })
            if (!user) {
                // User does not exists, create it
                const createUserRequestDto: CreateUserRequestDTO = new CreateUserRequestDTO(
                    bitbucketUser.username,
                    bitbucketUser.username,
                    bitbucketUser.display_name,
                    bitbucketUser.display_name,
                    LoginProviderEnum.BITBUCKET,
                    '',
                    '',
                    '',
                    'free',
                    bitbucketUser.links?.avatar?.href,
                    true,
                    [],
                    uuidv4(),
                )
                user = await this.usersService.createUser(createUserRequestDto)
            }

            const index: number = user.accounts.findIndex(
                (userAccount: UserAccount) => userAccount.type === LoginProviderEnum.BITBUCKET && userAccount.accountId === bitbucketUser.account_id,
            )
            if (index === -1) {
                user.accounts.push({
                    type: LoginProviderEnum.BITBUCKET,
                    accountId: bitbucketUser.account_id,
                    username: bitbucketUser.username,
                    accessToken,
                    payload: bitbucketLoginResponse.data,
                })
                Logger.log(`User ${bitbucketUser.username} is adding Bitbucket account`, BitbucketLoginProvider.name)
            } else {
                user.accounts[index].accessToken = accessToken
                Logger.log(`User ${bitbucketUser.username} is updating Bitbucket account`, BitbucketLoginProvider.name)
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
            Logger.error(`An error occurred loging a user in Bitbucket`, e, BitbucketLoginProvider.name)
            return null
        }
    }
}
