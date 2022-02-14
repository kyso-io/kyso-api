import { DynamicModule, Global } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth.controller'
import { AuthService, createProvider } from './auth.service'
import { PermissionsGuard } from './guards/permission.guard'
import { GithubLoginProvider } from './providers/github-login.provider'
import { GoogleLoginProvider } from './providers/google-login.provider'
import { KysoLoginProvider } from './providers/kyso-login.provider'
import { PlatformRoleMongoProvider } from './providers/mongo-platform-role.provider'
import { UserRoleMongoProvider } from './providers/mongo-user-role.provider'

@Global()
export class AuthModule {
    static forRoot(): DynamicModule {
        const dynamicProvider = createProvider()

        return {
            imports: [
                JwtModule.register({
                    secret: 'OHMYGODTHISISASECRET',
                }),
            ],
            module: AuthModule,
            providers: [
                AuthService,
                dynamicProvider,
                GithubLoginProvider,
                GoogleLoginProvider,
                KysoLoginProvider,
                PlatformRoleMongoProvider,
                PermissionsGuard,
                UserRoleMongoProvider,
            ],
            controllers: [AuthController],
            exports: [dynamicProvider, PermissionsGuard],
        }
    }
}
