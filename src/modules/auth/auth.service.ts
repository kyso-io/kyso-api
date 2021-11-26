import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { KysoLoginProvider } from './providers/kyso-login.provider';
import { LoginProvider } from './model/login-provider.enum';
import { GithubLoginProvider } from './providers/github-login.provider';

@Injectable()
export class AuthService {
    constructor(
      private readonly kysoLoginProvider: KysoLoginProvider,
      private readonly githubLoginProvider: GithubLoginProvider) { }

    async login(password: string, provider: LoginProvider, username?: string): Promise<String> {
      switch(provider) {
        case LoginProvider.KYSO:
        default:
          return this.kysoLoginProvider.login(password, username);
        case LoginProvider.GITHUB:
          return this.githubLoginProvider.login(password);
        // case LoginProvider.GOOGLE:
      }
    }
}
