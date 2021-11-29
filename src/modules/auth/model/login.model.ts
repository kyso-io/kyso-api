import { ApiProperty } from '@nestjs/swagger'
import { LoginProvider } from './login-provider.enum'

export class Login {
    @ApiProperty({
        description: `Username to login. Only required in kyso provider. This field is ignored in the rest
                      of providers`,
        required: false,
    })
    public username?: string
    @ApiProperty()
    public password: string
    @ApiProperty({
        description: `Authentication provider in which the user wants to rely. See schema for details`,
        enum: LoginProvider,
    })
    public provider: LoginProvider

    constructor() {
        this.username = ''
        this.password = ''
        this.provider = LoginProvider.KYSO
    }
}
