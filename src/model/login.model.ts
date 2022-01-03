import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional } from 'class-validator'
import { LoginProviderEnum } from './enum/login-provider.enum'

export class Login {
    @IsOptional()
    @ApiProperty({
        description: `Username to login. Only required in kyso provider. This field is ignored in the rest
                      of providers`,
        required: false,
    })
    public username?: string

    @IsNotEmpty()
    @ApiProperty()
    public password: string

    @IsNotEmpty()
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
