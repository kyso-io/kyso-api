import { AddUserAccountDTO, CreateUserRequestDTO, Login, LoginProviderEnum, Token, User, UserAccount } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ObjectId } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { Autowired } from '../../../decorators/autowired'
import { BitbucketReposService } from '../../bitbucket-repos/bitbucket-repos.service'
import { BitbucketEmail } from '../../bitbucket-repos/classes/bitbucket-email'
import { BitbucketPaginatedResponse } from '../../bitbucket-repos/classes/bitbucket-paginated-response'
import { UsersService } from '../../users/users.service'
import { BaseLoginProvider } from './base-login.provider'

@Injectable()
export class BitbucketLoginProvider extends BaseLoginProvider {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    @Autowired({ typeName: 'BitbucketReposService' })
    private bitbucketReposService: BitbucketReposService

    constructor(protected readonly jwtService: JwtService) {
        super(jwtService)
    }

    async login(login: Login): Promise<string> {
        try {
            const bitbucketLoginResponse = await this.bitbucketReposService.login(login.password)
            const accessToken: string = bitbucketLoginResponse.access_token
            const bitbucketUser: any = await this.bitbucketReposService.getUser(accessToken)
            const emailsResponse: BitbucketPaginatedResponse<BitbucketEmail> = await this.bitbucketReposService.getEmail(accessToken)
            let email: string = null
            if (emailsResponse?.values && emailsResponse.values.length > 0) {
                const bitbucketEmail: BitbucketEmail = emailsResponse.values.find((email: BitbucketEmail) => email.is_primary)
                if (bitbucketEmail) {
                    email = bitbucketEmail.email
                }
            }
            // Get user's detail
            // Check if the user exists in database, and if not, create it
            let user: User = await this.usersService.getUser({
                filter: { email: bitbucketUser.email },
            })
            if (!user) {
                // User does not exists, create it
                const createUserRequestDto: CreateUserRequestDTO = new CreateUserRequestDTO(
                    email ? email : bitbucketUser.username,
                    bitbucketUser.username,
                    bitbucketUser.display_name,
                    bitbucketUser.display_name,
                    LoginProviderEnum.BITBUCKET,
                    '',
                    '',
                    '',
                    'free',
                    bitbucketUser.links?.avatar?.href,
                    null,
                    false,
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
                    payload: bitbucketLoginResponse,
                })
                Logger.log(`User ${bitbucketUser.username} is adding Bitbucket account`, BitbucketLoginProvider.name)
            } else {
                user.accounts[index].accessToken = accessToken
                user.accounts[index].payload = bitbucketLoginResponse
                Logger.log(`User ${bitbucketUser.username} is updating Bitbucket account`, BitbucketLoginProvider.name)
            }
            await this.usersService.updateUser({ _id: new ObjectId(user.id) }, { $set: { accounts: user.accounts } })


            await this.addUserToOrganizationsAutomatically(user);
            return await this.createToken(user);
        } catch (e) {
            Logger.error(`An error occurred loging a user in Bitbucket`, e, BitbucketLoginProvider.name)
            return null
        }
    }

    public async addUserAccount(token: Token, addUserAccount: AddUserAccountDTO): Promise<boolean> {
        try {
            const bitbucketLoginResponse = await this.bitbucketReposService.login(addUserAccount.code)
            const accessToken: string = bitbucketLoginResponse.access_token
            const bitbucketUser: any = await this.bitbucketReposService.getUser(accessToken)
            const user: User = await this.usersService.getUserById(token.id)
            const index: number = user.accounts.findIndex(
                (userAccount: UserAccount) => userAccount.type === LoginProviderEnum.BITBUCKET && userAccount.accountId === bitbucketUser.account_id,
            )
            if (index === -1) {
                user.accounts.push({
                    type: LoginProviderEnum.BITBUCKET,
                    accountId: bitbucketUser.account_id,
                    username: bitbucketUser.username,
                    accessToken,
                    payload: bitbucketLoginResponse,
                })
                Logger.log(`User ${bitbucketUser.username} is adding Bitbucket account`, BitbucketLoginProvider.name)
            } else {
                user.accounts[index].accessToken = accessToken
                user.accounts[index].payload = bitbucketLoginResponse
                Logger.log(`User ${bitbucketUser.username} is updating Bitbucket account`, BitbucketLoginProvider.name)
            }
            await this.usersService.updateUser({ _id: new ObjectId(user.id) }, { $set: { accounts: user.accounts } })
            return true
        } catch (e) {
            Logger.error(`An error occurred loging a user in Bitbucket`, e, BitbucketLoginProvider.name)
            return false
        }
    }
}
