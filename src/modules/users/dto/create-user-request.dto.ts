import { ApiProperty } from '@nestjs/swagger'
import * as mongo from 'mongodb'
import { LoginProvider } from 'src/modules/auth/model/login-provider.enum'
import { GlobalPermissionsEnum, Permissions } from 'src/security/general-permissions.enum'

export class CreateUserRequest {
    @ApiProperty()
    public _id?: mongo.ObjectId
    @ApiProperty()
    public email: string
    @ApiProperty()
    public username: string
    @ApiProperty()
    public nickname: string
    @ApiProperty({
        enum: LoginProvider
    })
    public provider: LoginProvider
    @ApiProperty()
    public bio: string
    @ApiProperty()
    public plan: string
    @ApiProperty()
    public _hashed_password: string
    @ApiProperty()
    public emailVerified: boolean
    @ApiProperty()
    public _email_verify_token?: string
    @ApiProperty()
    public global_permissions: GlobalPermissionsEnum[]

    constructor(email: string, username: string, nickname: string, provider: LoginProvider, bio: string, plan: string, 
        _hashed_password: string, emailVerified: boolean, global_permissions: GlobalPermissionsEnum[], _id?: mongo.ObjectId, _email_verify_token?: string) {
        this.email = email
        this.username = username
        this.nickname = nickname
        this.provider = provider
        this.bio = bio
        this.plan = plan
        this._hashed_password = _hashed_password
        this.emailVerified = emailVerified
        this._id = _id 
        this.global_permissions = global_permissions
        this._email_verify_token = _email_verify_token
    }
}

export const DEFAULT_GLOBAL_ADMIN_USER = new CreateUserRequest(
    'default-admin@kyso.io',
    'default-admin@kyso.io',
    'default-admin',
    LoginProvider.KYSO,
    '',
    'free',
    'empty.password',
    false, 
    [GlobalPermissionsEnum.GLOBAL_ADMIN],
    new mongo.ObjectId('61a8ae8f9c2bc3c5a2144000')
)