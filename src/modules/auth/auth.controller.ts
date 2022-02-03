import { CreateUserRequestDTO, Login, NormalizedResponseDTO, User } from '@kyso-io/kyso-model'
import { Body, Controller, Post } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Autowired } from '../../decorators/autowired'
import { GenericController } from '../../generic/controller.generic'
import { UsersService } from '../users/users.service'
import { AuthService } from './auth.service'

@ApiTags('auth')
@Controller('auth')
export class AuthController extends GenericController<string> {
    @Autowired({ typeName: 'UsersService' })
    private readonly usersService: UsersService

    constructor(private readonly authService: AuthService) {
        super()
    }

    assignReferences(item: string) {
        // Nothing to do here
    }

    @Post('/login')
    @ApiOperation({
        summary: `Logs an user into Kyso`,
        description: `Allows existing users to log-in into Kyso`,
    })
    @ApiResponse({
        status: 200,
        description: `JWT token related to user`,
        type: String,
    })
    @ApiBody({
        description: 'Login credentials and provider',
        required: true,
        type: Login,
        examples: {
            'Login as palpatine': {
                summary: 'Palpatine is a global administrator',
                value: {
                    username: 'palpatine@kyso.io',
                    password: 'n0tiene',
                    provider: 'kyso',
                },
            },
        },
    })
    async login(@Body() login: Login): Promise<NormalizedResponseDTO<string>> {
        const jwt: string = await this.authService.login(login.password, login.provider, login.username)
        return new NormalizedResponseDTO(jwt)
    }

    @Post('/sign-up')
    @ApiOperation({
        summary: `Signs up an user into Kyso`,
        description: `Allows new users to sign-up into Kyso`,
    })
    @ApiNormalizedResponse({ status: 201, description: `Registered user`, type: User })
    public async signUp(@Body() data: CreateUserRequestDTO): Promise<NormalizedResponseDTO<User>> {
        const user: User = await this.usersService.createUser(data)
        return new NormalizedResponseDTO(user)
    }
}
