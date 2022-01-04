import { ApiProperty } from '@nestjs/swagger'
import { IsAlphanumeric } from 'class-validator'
import { BaseUser } from '../base-user.model'

export class CreateUserRequest extends BaseUser {
    @ApiProperty()
    @IsAlphanumeric()
    public password: string

    constructor(email, username, nickname, provider, bio, plan, avatar_url, email_verified, password, global_permissions) {
        super(email, username, nickname, provider, bio, plan, avatar_url, email_verified, global_permissions)
        
        this.password = password
    }
}
