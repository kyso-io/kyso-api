import { ApiProperty } from '@nestjs/swagger'
import { Exclude } from 'class-transformer'
import { IsAlphanumeric, IsArray, IsBooleanString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsUrl, Length } from 'class-validator'
import * as mongo from 'mongodb'
import { LoginProviderEnum } from 'src/model/enum/login-provider.enum'
import { GlobalPermissionsEnum } from 'src/security/general-permissions.enum'
import { BaseModel } from './base.model'

export class User extends BaseModel {
    @IsEmail()
    @IsNotEmpty()
    @ApiProperty()
    public email: string

    @IsAlphanumeric()
    @IsNotEmpty()
    @ApiProperty()
    public username: string

    @IsAlphanumeric()
    @IsNotEmpty()
    @ApiProperty()
    public nickname: string

    @IsNotEmpty()
    @ApiProperty({
        enum: LoginProviderEnum,
    })
    public provider: LoginProviderEnum

    @IsAlphanumeric()
    @Length(0, 500)
    @IsNotEmpty()
    @ApiProperty({
        maxLength: 500,
    })
    public bio: string

    @IsAlphanumeric()
    @IsNotEmpty()
    @ApiProperty()
    public plan: string

    @IsAlphanumeric()
    @ApiProperty()
    @Exclude()
    public hashed_password: string

    @IsAlphanumeric()
    @IsOptional()
    @Exclude({
        // toPlainOnly: true
    })
    @ApiProperty({
        description: 'OAUTH2 token from OAUTH login providers',
    })
    public accessToken: string

    @IsAlphanumeric()
    @IsOptional()
    @Exclude({
        // toPlainOnly: true
    })
    @ApiProperty({
        description: 'Password in clear text. Used for creation and edition',
    })
    public password?: string

    @IsUrl()
    @IsNotEmpty()
    @ApiProperty()
    public avatar_url: string

    @IsBooleanString()
    @ApiProperty()
    public email_verified: boolean

    @IsAlphanumeric()
    @IsOptional()
    @ApiProperty()
    public _email_verify_token?: string

    @IsArray()
    @IsEnum(GlobalPermissionsEnum, { each: true })
    @ApiProperty()
    public global_permissions: GlobalPermissionsEnum[]

    constructor(
        email: string,
        username: string,
        nickname: string,
        provider: LoginProviderEnum,
        bio: string,
        plan: string,
        password: string,
        avatarUrl: string,
        emailVerified: boolean,
        global_permissions: GlobalPermissionsEnum[],
        _id?: string,
        _email_verify_token?: string,
    ) {
        super()
        this.email = email
        this.username = username
        this.nickname = nickname
        this.provider = provider
        this.bio = bio
        this.plan = plan
        this.avatar_url = avatarUrl
        this.password = password
        this.email_verified = emailVerified
        this.global_permissions = global_permissions

        // i think we should let mongo handle setting the objectid
        // if (_id) {
        //     this.id = _id
        // } else {
        //     this.id = new mongo.ObjectId().toString()
        // }

        if (_email_verify_token) {
            this._email_verify_token = _email_verify_token
        }
    }

    static fromGithubUser(userData: any, emailData: any): User {
        const newUser = new User(emailData.email, userData.login, userData.name, LoginProviderEnum.GITHUB, '', 'free', '', userData.avatar_url, true, [])

        return newUser
    }
}

export const DEFAULT_GLOBAL_ADMIN_USER = new User(
    'default-admin@kyso.io',
    'default-admin@kyso.io',
    'default-admin',
    LoginProviderEnum.KYSO,
    '',
    'free',
    'empty.password',
    'https://bit.ly/32hyGaj',
    false,
    [GlobalPermissionsEnum.GLOBAL_ADMIN],
    new mongo.ObjectId('61a8ae8f9c2bc3c5a2144000').toString(),
)
