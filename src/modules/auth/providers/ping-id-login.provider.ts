import { CreateUserRequestDTO, Login, LoginProviderEnum } from '@kyso-io/kyso-model'
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import slug from 'src/helpers/slugify'
import { Autowired } from '../../../decorators/autowired'
import { UsersService } from '../../users/users.service'
import { BaseLoginProvider } from './base-login.provider'

@Injectable()
export class PingIdLoginProvider extends BaseLoginProvider {
    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    constructor(protected readonly jwtService: JwtService) {
        super(jwtService)
    }

    public async login(login: Login): Promise<string> {
        Logger.log(`User ${login.email} is trying to login with PingId`)

        try {
            let user = await this.usersService.getUser({
                filter: { email: login.email },
            })

            if (!user) {
                // New User
                const name = `${login.payload.givenName} ${login.payload.sn}`
                const portrait = login.payload.profilePicture ? login.payload.profilePicture : ''
                Logger.log(`User ${login.email} is a new user`)
                const createUserRequestDto: CreateUserRequestDTO = new CreateUserRequestDTO(
                    login.email,
                    slug(login.email),
                    name,
                    name,
                    LoginProviderEnum.PING_ID_SAML,
                    '',
                    '',
                    '',
                    'free',
                    portrait,
                    null,
                    true,   // If comes from PingID is an enterprise user, that means we can assume is verified
                    [],
                    login.password,
                )
                user = await this.usersService.createUser(createUserRequestDto)
            }

            return await this.createToken(user)
        } catch (e) {
            Logger.error("Exception login with PingID", e);
            console.log(e)
            throw new UnauthorizedException('Invalid credentials')
        }
    }
}
