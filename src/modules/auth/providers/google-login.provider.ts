import { Login } from '@kyso-io/kyso-model'
import { Injectable } from '@nestjs/common'

@Injectable()
export class GoogleLoginProvider {
    public async login(login: Login): Promise<string> {
        return 'google-login'
    }
}
