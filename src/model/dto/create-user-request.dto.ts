import { ApiProperty } from '@nestjs/swagger'
import { GlobalPermissionsEnum } from '../../security/general-permissions.enum'
import { LoginProviderEnum } from '../enum/login-provider.enum'

export class CreateUserRequest {
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

    @ApiProperty()
    public password: string

    @ApiProperty()
    public global_permissions: GlobalPermissionsEnum[]

    constructor(email, username, nickname, provider, bio, plan, password, global_permissions) {
        this.email = email
        this.username = username
        this.nickname = nickname
        this.provider = provider
        this.bio = bio
        this.plan = plan
        this.password = password
        this.global_permissions = global_permissions
    }
}
