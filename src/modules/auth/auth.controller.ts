import { Controller, Post, Body } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GenericController } from 'src/generic/controller.generic';
import { AuthService } from './auth.service';
import { Login } from './model/login.model';


@ApiTags('auth')
@Controller('auth')
export class AuthController extends GenericController<String> {
    constructor(private readonly authService: AuthService) {
        super();
    }

    assignReferences(item: String) {
        // Nothing to do here
    }

    @Post("/login")
    @ApiOperation({
        summary: `Logs an user into Kyso`,
    })
    @ApiResponse({ status: 200, description: `JWT token related to user`, type: String})
    async login(@Body() login: Login) {
        return this.authService.login(login.password, login.provider, login.username);
    }
}
