import { ApiProperty } from '@nestjs/swagger'
import { IsAlphanumeric, IsArray, IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsUrl, Length } from 'class-validator'
import { GlobalPermissionsEnum } from '../security/general-permissions.enum'
import { BaseModel } from './base.model'
import { LoginProviderEnum } from './enum/login-provider.enum'

export class BaseUser extends BaseModel {
    @IsEmail()
    @IsNotEmpty()
    @ApiProperty()
    public email: string

    @IsNotEmpty()
    @ApiProperty()
    public username: string

    @IsNotEmpty()
    @ApiProperty()
    public nickname: string

    @IsNotEmpty()
    @ApiProperty({
        enum: LoginProviderEnum,
    })
    public provider: LoginProviderEnum

    @Length(0, 500)
    @ApiProperty({
        maxLength: 500,
    })
    public bio: string

    @IsAlphanumeric()
    @IsNotEmpty()
    @ApiProperty()
    public plan: string

    @IsUrl()
    @IsNotEmpty()
    @ApiProperty()
    public avatar_url: string

    @IsBoolean()
    @ApiProperty()
    public email_verified: boolean

    @IsArray()
    @IsEnum(GlobalPermissionsEnum, { each: true })
    @ApiProperty()
    public global_permissions: GlobalPermissionsEnum[]

    @ApiProperty()
    public type: 'user'

    buildHatoes(relations?: any) {}

    constructor(
        email: string,
        username: string,
        nickname: string,
        provider: LoginProviderEnum,
        bio: string,
        plan: string,
        avatarUrl: string,
        emailVerified: boolean,
        global_permissions: GlobalPermissionsEnum[],
        _id?: string,
    ) {
        super()
        this.email = email
        this.username = username
        this.nickname = nickname
        this.provider = provider
        this.bio = bio
        this.plan = plan
        this.avatar_url = avatarUrl
        this.email_verified = emailVerified
        this.global_permissions = global_permissions
    }
}
