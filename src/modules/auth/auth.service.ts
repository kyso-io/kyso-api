import { Injectable } from '@nestjs/common'
import { KysoLoginProvider } from './providers/kyso-login.provider'
import { LoginProvider } from './model/login-provider.enum'
import { GithubLoginProvider } from './providers/github-login.provider'
import { JwtService } from '@nestjs/jwt'

@Injectable()
export class AuthService {
    constructor(
        private readonly kysoLoginProvider: KysoLoginProvider, 
        private readonly githubLoginProvider: GithubLoginProvider,
        private readonly jwtService: JwtService) {}

    async login(password: string, provider: LoginProvider, username?: string): Promise<String> {
        switch (provider) {
            case LoginProvider.KYSO:
            default:
                return this.kysoLoginProvider.login(password, username)
            case LoginProvider.GITHUB:
                return this.githubLoginProvider.login(password)
            // case LoginProvider.GOOGLE:
        }
    }

    /**
     * Returns undefined if the token is invalid. Otherwise, return the decoded token
     * 
     * @param token Token to evaluate and decode
     * @returns 
     */
    evaluateAndDecodeToken(token: string): any {
        try {
            this.jwtService.verify(token)
            const decodedToken = this.jwtService.decode(token);

            return decodedToken;
        } catch(ex) {
            // TOKEN IS NOT VALID
            return undefined
        }
    }
}
