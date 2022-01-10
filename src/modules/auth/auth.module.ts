import { Global, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { PermissionsGuard } from './guards/permission.guard'
import { GithubLoginProvider } from './providers/github-login.provider'
import { KysoLoginProvider } from './providers/kyso-login.provider'
import { PlatformRoleMongoProvider } from './providers/mongo-platform-role.provider'
import { UserRoleMongoProvider } from './providers/mongo-user-role.provider'

@Global()
@Module({
    imports: [
        JwtModule.register({
            secret: 'OHMYGODTHISISASECRET',
        }),
    ],
    providers: [UserRoleMongoProvider, AuthService, KysoLoginProvider, GithubLoginProvider, PlatformRoleMongoProvider, PermissionsGuard],
    controllers: [AuthController],
    exports: [AuthService, PermissionsGuard],
})
export class AuthModule {}
