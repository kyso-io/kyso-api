import { ApiProperty } from '@nestjs/swagger'
import { Exclude } from 'class-transformer'
import { IsAlphanumeric, IsOptional } from 'class-validator'
import * as mongo from 'mongodb'
import { AuthService } from '../modules/auth/auth.service'
import { GlobalPermissionsEnum } from '../security/general-permissions.enum'
import { BaseUser } from './base-user.model'
import { CreateUserRequest } from './dto/create-user-request.dto'
import { LoginProviderEnum } from './enum/login-provider.enum'

export class User extends BaseUser {
    @IsAlphanumeric()
    @ApiProperty()
    @Exclude()
    public hashed_password: string

    @IsAlphanumeric()
    @IsOptional()
    @ApiProperty({
        description: 'OAUTH2 token from OAUTH login providers',
    })
    public accessToken: string

    @IsAlphanumeric()
    @IsOptional()
    @ApiProperty()
    public _email_verify_token?: string

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
        hashed_password: string,
        access_token: string,
        _id?: string,
        _email_verify_token?: string,
    ) {
        super(email, username, nickname, provider, bio, plan, avatarUrl, emailVerified, global_permissions, _id)

        this.hashed_password = hashed_password
        this.accessToken = access_token

        if (_email_verify_token) {
            this._email_verify_token = _email_verify_token
        }
    }

    static fromGithubUser(userData: any, emailData: any): User {
        const newUser = new User(emailData.email, userData.login, userData.name, LoginProviderEnum.GITHUB, '', 'free', userData.avatar_url, true, [], '', '')

        return newUser
    }

    static fromCreateUserRequest(request: CreateUserRequest): User {
        const newUser = new User(
            request.email,
            request.username,
            request.nickname,
            request.provider,
            request.bio,
            request.plan,
            request.avatar_url,
            request.email_verified,
            request.global_permissions,
            '',
            '',
        )

        newUser.hashed_password = AuthService.hashPassword(request.password)

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
    'https://bit.ly/32hyGaj',
    false,
    [GlobalPermissionsEnum.GLOBAL_ADMIN],
    '',
    '',
    new mongo.ObjectId('61a8ae8f9c2bc3c5a2144000').toString(),
)
