import { ApiProperty } from '@nestjs/swagger'
import { IsAlphanumeric, IsEmail, IsNotEmpty, IsObject, IsUrl } from 'class-validator'
import { TokenPermissions } from './token-permissions.model'

export class Token {
    @ApiProperty()
    @IsNotEmpty()
    public id: string

    @ApiProperty()
    @IsNotEmpty()
    @IsAlphanumeric()
    public username: string

    @ApiProperty()
    @IsAlphanumeric()
    @IsNotEmpty()
    public nickname: string

    @ApiProperty()
    @IsEmail()
    @IsNotEmpty()
    public email: string

    @ApiProperty()
    @IsNotEmpty()
    @IsAlphanumeric()
    public plan: string

    @ApiProperty()
    @IsNotEmpty()
    @IsObject()
    public permissions: TokenPermissions

    @ApiProperty()
    @IsUrl()
    @IsNotEmpty()
    public avatar_url: string

    constructor(id: string, username: string, nickname: string, email: string, plan: string, permissions: TokenPermissions, avatar_url: string) {
        this.id = id
        this.nickname = nickname
        this.username = username
        this.email = email
        this.plan = plan
        this.permissions = permissions
        this.avatar_url = avatar_url
    }
}
