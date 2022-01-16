import { IsEnum, IsNotEmpty, IsNotEmptyObject } from 'class-validator'
import { LoginProviderEnum } from './enum/login-provider.enum'

export class UserAccount {
    @IsEnum(LoginProviderEnum)
    public type: LoginProviderEnum

    @IsNotEmpty()
    public accountId: string

    @IsNotEmptyObject()
    public payload: any

    constructor() {
        this.type = null
        this.accountId = null
        this.payload = null
    }
}
