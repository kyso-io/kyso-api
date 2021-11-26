import { Controller, Get, Param, Patch, Post, Req, Res, Body } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from 'src/model/user.model';
import { AuthService } from './auth.service';
import { LoginProvider } from './model/login-provider.enum';
import { Login } from './model/login.model';


@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {
        
    }

    @Post("/login")
    @ApiOperation({
        summary: `Logs an user into Kyso`,
    })
    @ApiResponse({ status: 200, description: `JWT token related to user`, type: User})
    async login(@Body() login: Login) {
        return this.authService.login(login.password, login.provider, login.username);
    }
}
