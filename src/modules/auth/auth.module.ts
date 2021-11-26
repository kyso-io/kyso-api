import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { KysoLoginProvider } from './providers/kyso-login.provider';
import { GithubLoginProvider } from './providers/github-login.provider';
import { GithubReposModule } from '../github-repos/github-repos.module';
@Module({
    imports: [
        UsersModule,
        GithubReposModule,
        JwtModule.register({
          secret: "OHMYGODTHISISASECRET"
        })
    ],
    providers: [
      AuthService,
      KysoLoginProvider,
      GithubLoginProvider
    ],
    controllers: [AuthController],
    exports: [ AuthService ]
  })
export class AuthModule { }
