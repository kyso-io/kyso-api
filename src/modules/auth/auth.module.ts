import { DynamicModule, Global } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth.controller'
import { AuthService, createProvider } from './auth.service'
import { PlatformRoleService, createPlatformRoleProvider } from './platform-role.service'
import { UserRoleService, createUserRoleProvider } from './user-role.service'
import { PermissionsGuard } from './guards/permission.guard'
import { GithubLoginProvider } from './providers/github-login.provider'
import { GoogleLoginProvider } from './providers/google-login.provider'
import { KysoLoginProvider } from './providers/kyso-login.provider'
import { PlatformRoleMongoProvider } from './providers/mongo-platform-role.provider'
import { UserRoleMongoProvider } from './providers/mongo-user-role.provider'
import { PingIdLoginProvider } from './providers/ping-id-login.provider'

@Global()
export class AuthModule {
    static forRoot(): DynamicModule {
        const dynamicProvider = createProvider()
        const platformRoleDynamicProvider = createPlatformRoleProvider()
        const userRoleDynamicProvider = createUserRoleProvider()

        return {
            imports: [
                JwtModule.register({
                    secret: 'OHMYGODTHISISASECRET',
                }),
            ],
            module: AuthModule,
            providers: [
                AuthService,
                PlatformRoleService,
                UserRoleService,
                dynamicProvider,
                userRoleDynamicProvider,
                platformRoleDynamicProvider,
                GithubLoginProvider,
                GoogleLoginProvider,
                KysoLoginProvider,
                PlatformRoleMongoProvider,
                PermissionsGuard,
                UserRoleMongoProvider,
                PingIdLoginProvider
            ],
            controllers: [AuthController],
            exports: [dynamicProvider, platformRoleDynamicProvider, userRoleDynamicProvider, PermissionsGuard],
        }
    }
}
