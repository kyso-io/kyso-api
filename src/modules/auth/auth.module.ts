import { Global, Module } from '@nestjs/common'
import { AuthService } from './auth.service'
import { GithubLoginProvider } from './providers/github-login.provider'
import { KysoLoginProvider } from './providers/kyso-login.provider'
import { PlatformRoleMongoProvider } from './providers/mongo-platform-role.provider'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth.controller'
import { UsersModule } from '../users/users.module'
import { TeamsModule } from '../teams/teams.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { GithubReposModule } from '../github-repos/github-repos.module'
import { PermissionsGuard } from './guards/permission.guard'
import { UserRoleMongoProvider } from './providers/mongo-user-role.provider'

@Global()
@Module({
    imports: [
        JwtModule.register({
            secret: 'OHMYGODTHISISASECRET',
        }),
        TeamsModule,
        OrganizationsModule,
        GithubReposModule,
    ],
    providers: [UserRoleMongoProvider, AuthService, KysoLoginProvider, GithubLoginProvider, PlatformRoleMongoProvider, PermissionsGuard],
    controllers: [AuthController],
    exports: [AuthService, PermissionsGuard],
})
export class AuthModule {}
