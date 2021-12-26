import { Body, Controller, Post } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { GenericController } from 'src/generic/controller.generic'
import { Login } from 'src/model/login.model'
import { AuthService } from './auth.service'

@ApiTags('auth')
@Controller('auth')
export class AuthController extends GenericController<string> {
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
        return this.authService.login(login.password, login.provider, login.username)
    }
}
