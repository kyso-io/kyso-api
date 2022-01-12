import { Body, Controller, Post } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Autowired } from '../../decorators/autowired'
import { GenericController } from '../../generic/controller.generic'
import { CreateUserRequest } from '../../model/dto/create-user-request.dto'
import { Login } from '../../model/login.model'
import { User } from '../../model/user.model'
import { UsersService } from '../users/users.service'
import { AuthService } from './auth.service'

@ApiTags('auth')
@Controller('auth')
export class AuthController extends GenericController<string> {
    @Autowired(UsersService)
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
    async login(@Body() login: Login) {
        const jwt = await this.authService.login(login.password, login.provider, login.username)
        return jwt
    }

    @Post('/sign-up')
    @ApiOperation({
        summary: `Signs up an user into Kyso`,
        description: `Allows new users to sign-up into Kyso`,
    })
    @ApiResponse({
        status: 201,
        description: `User`,
        type: User,
    })
    public async signUp(@Body() createUserRequest: CreateUserRequest): Promise<User> {
        return this.usersService.createUser(createUserRequest)
    }
}
