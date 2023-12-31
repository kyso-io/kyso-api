import { DynamicModule, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService, createProvider } from './auth.service';
import { EmailVerifiedGuard } from './guards/email-verified.guard';
import { PermissionsGuard } from './guards/permission.guard';
import { SolvedCaptchaGuard } from './guards/solved-captcha.guard';
import { createPlatformRoleProvider, PlatformRoleService } from './platform-role.service';
import { BaseLoginProvider } from './providers/base-login.provider';
import { BitbucketLoginProvider } from './providers/bitbucket-login.provider';
import { GithubLoginProvider } from './providers/github-login.provider';
import { GitlabLoginProvider } from './providers/gitlab-login.provider';
import { GoogleLoginProvider } from './providers/google-login.provider';
import { KysoLoginProvider } from './providers/kyso-login.provider';
import { PlatformRoleMongoProvider } from './providers/mongo-platform-role.provider';
import { UserRoleMongoProvider } from './providers/mongo-user-role.provider';
import { OktaLoginProvider } from './providers/okta-login.provider';
import { PingIdLoginProvider } from './providers/ping-id-login.provider';
import { createUserRoleProvider, UserRoleService } from './user-role.service';

@Global()
export class AuthModule {
  static forRoot(): DynamicModule {
    const dynamicProvider = createProvider();
    const platformRoleDynamicProvider = createPlatformRoleProvider();
    const userRoleDynamicProvider = createUserRoleProvider();

    return {
      imports: [
        JwtModule.register({
          secret: 'OHMYGODTHISISASECRET',
        }),
      ],
      module: AuthModule,
      providers: [
        AuthService,
        BaseLoginProvider,
        BitbucketLoginProvider,
        dynamicProvider,
        EmailVerifiedGuard,
        GithubLoginProvider,
        GitlabLoginProvider,
        GoogleLoginProvider,
        KysoLoginProvider,
        OktaLoginProvider,
        PermissionsGuard,
        PingIdLoginProvider,
        platformRoleDynamicProvider,
        PlatformRoleMongoProvider,
        PlatformRoleService,
        SolvedCaptchaGuard,
        userRoleDynamicProvider,
        UserRoleMongoProvider,
        UserRoleService,
      ],
      controllers: [AuthController],
      exports: [dynamicProvider, EmailVerifiedGuard, PermissionsGuard, platformRoleDynamicProvider, SolvedCaptchaGuard, userRoleDynamicProvider],
    };
  }
}
