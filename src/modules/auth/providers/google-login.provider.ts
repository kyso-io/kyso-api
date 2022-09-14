import { CreateUserRequestDTO, KysoSettingsEnum, Login, LoginProviderEnum, UserAccount } from '@kyso-io/kyso-model'
import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import axios from 'axios'
import { google } from 'googleapis'
import { ObjectId } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { Autowired } from '../../../decorators/autowired'
import { UsersService } from '../../users/users.service'
import { BaseLoginProvider } from './base-login.provider'

@Injectable()
export class GoogleLoginProvider extends BaseLoginProvider {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    constructor(protected readonly jwtService: JwtService) {
        super(jwtService)
    }

    public async login(login: Login): Promise<string> {
        if (!login?.payload || login.payload == null || login.payload.length == 0) {
            throw new BadRequestException('Missing redirect_uri in payload field')
        }
        try {
            const clientId = await this.kysoSettingsService.getValue(KysoSettingsEnum.AUTH_GOOGLE_CLIENT_ID)
            const clientSecret = await this.kysoSettingsService.getValue(KysoSettingsEnum.AUTH_GOOGLE_CLIENT_SECRET)
            const oauth2GoogleClient = new google.auth.OAuth2(clientId, clientSecret, login.payload)
            const { tokens } = await oauth2GoogleClient.getToken(login.password)
            const { data: googleUser } = await axios.get(`https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${tokens.access_token}`, {
                headers: {
                    Authorization: `Bearer ${tokens.id_token}`,
                },
            })

            console.log(googleUser);

            let user = await this.usersService.getUser({
                filter: { username: googleUser.email },
            })
            if (!user) {
                // New User
                let name = googleUser.name
                if (googleUser?.family_name && googleUser.family_name.length > 0) {
                    name = `${googleUser.given_name} ${googleUser.family_name}`
                }
                Logger.log(`User ${googleUser.email} is a new user`, GoogleLoginProvider.name)
                const createUserRequestDto: CreateUserRequestDTO = new CreateUserRequestDTO(
                    googleUser.email,
                    googleUser.email,
                    name,
                    googleUser.name,
                    LoginProviderEnum.GOOGLE,
                    '',
                    '',
                    '',
                    'free',
                    googleUser.picture,
                    null,
                    false,
                    [],
                    uuidv4(),
                )
                user = await this.usersService.createUser(createUserRequestDto)
            }
            const index: number = user.accounts.findIndex(
                (userAccount: UserAccount) => userAccount.type === LoginProviderEnum.GOOGLE && userAccount.username === googleUser.email,
            )
            if (index === -1) {
                user.accounts.push({
                    type: LoginProviderEnum.GOOGLE,
                    accountId: googleUser.email,
                    username: googleUser.email,
                    accessToken: tokens.access_token,
                    payload: tokens,
                })
                Logger.log(`User ${googleUser.email} is adding Google account`, GoogleLoginProvider.name)
            } else {
                user.accounts[index].accessToken = tokens.access_token
                user.accounts[index].payload = tokens
                Logger.log(`User ${googleUser.email} is updating Google account`, GoogleLoginProvider.name)
            }

            await this.usersService.updateUser({ _id: new ObjectId(user.id) }, { $set: { accounts: user.accounts } })

            await this.addUserToOrganizationsAutomatically(user)

            return await this.createToken(user)
        } catch (e) {
            Logger.error('Error login with google provider', e)
            throw new UnauthorizedException('Invalid credentials')
        }
    }
}
