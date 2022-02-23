import { CreateUserRequestDTO, Login, LoginProviderEnum, Token, User, UserAccount } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ObjectId } from 'mongodb'
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
        const bitbucketLoginResponse = await this.bitbucketReposService.login(login.password)
        const accessToken: string = bitbucketLoginResponse.access_token
        const bitbucketUser: any = await this.bitbucketReposService.getUser(accessToken)

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
                bitbucketUser.display_name,
                bitbucketUser.nickname,
                LoginProviderEnum.BITBUCKET,
                '',
                '',
                '',
                'free',
                bitbucketUser.links?.avatar?.href,
                true,
                [],
                '',
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
            Logger.log(`User ${login.username} is adding Bitbucket account`, BitbucketLoginProvider.name)
        } else {
            user.accounts[index].accessToken = accessToken
            Logger.log(`User ${login.username} is updating Bitbucket account`, BitbucketLoginProvider.name)
        }
        await this.usersService.updateUser({ _id: new ObjectId(user.id) }, { $set: { accounts: user.accounts } })

        const payload: Token = new Token(
            user.id.toString(),
            user.name,
            user.username,
            user.nickname,
            user.email,
            user.plan,
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
    }
}
