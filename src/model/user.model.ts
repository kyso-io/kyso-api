import { ApiProperty } from '@nestjs/swagger'
import { BaseModel } from './base.model'
import { LoginProviderEnum } from 'src/model/enum/login-provider.enum'
import { GlobalPermissionsEnum, Permissions } from 'src/security/general-permissions.enum'
import { Exclude } from 'class-transformer'
import { CreateUserRequest } from 'src/model/dto/create-user-request.dto'
import { AuthService } from 'src/modules/auth/auth.service'
import * as mongo from 'mongodb'

export class User extends BaseModel {
    @ApiProperty()
    public email: string
    @ApiProperty()
    public username: string
    @ApiProperty()
    public nickname: string
    @ApiProperty({
        enum: LoginProviderEnum,
    })
    public provider: LoginProviderEnum
    @ApiProperty()
    public bio: string
    @ApiProperty()
    public plan: string

    @Exclude()
    @ApiProperty()
    public hashed_password: string

    @Exclude()
    @ApiProperty({
        description: 'OAUTH2 token from OAUTH login providers',
    })
    public accessToken: string

    @Exclude()
    @ApiProperty({
        description: 'Password in clear text. Used for creation and edition',
    })
    public password?: string

    @ApiProperty()
    public avatar_url: string

    @ApiProperty()
    public email_verified: boolean

    @Exclude()
    @ApiProperty()
    public _email_verify_token?: string

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

        if (_id) {
            this.id = _id
        } else {
            this.id = new mongo.ObjectId().toString()
        }

        if (_email_verify_token) {
            this._email_verify_token = _email_verify_token
        }
    }

    static fromGithubUser(userData: any, emailData: any): User {
        let newUser = new User(emailData.email, userData.login, 
            userData.name, LoginProviderEnum.GITHUB, '', 'free', '', userData.avatar_url, true, [])

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
    "https://bit.ly/32hyGaj",
    false,
    [GlobalPermissionsEnum.GLOBAL_ADMIN],
    new mongo.ObjectId('61a8ae8f9c2bc3c5a2144000').toString(),
)
