import { ApiProperty } from '@nestjs/swagger'
import { LoginProviderEnum } from './enum/login-provider.enum'

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
        enum: LoginProviderEnum,
    })
    public provider: LoginProviderEnum

    constructor(password, provider: LoginProviderEnum, username?) {
        this.password = password
        this.provider = provider
        this.username = username
    }
}
