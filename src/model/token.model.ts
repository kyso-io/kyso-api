import { ApiProperty } from '@nestjs/swagger'
import { TokenPermissions } from './token-permissions.model'

export class Token {
    @ApiProperty()
    public id: string

    @ApiProperty()
    public username: string

    @ApiProperty()
    public nickname: string

    @ApiProperty()
    public email: string

    @ApiProperty()
    public plan: string

    @ApiProperty()
    public permissions: TokenPermissions

    @ApiProperty()
    public avatar_url: string

    constructor(id: string, username: string, nickname: string, email: string, plan: string, permissions: TokenPermissions, avatar_url: string) {
        this.id = id
        this.username = username
        this.email = email
        this.plan = plan
        this.permissions = permissions
        this.avatar_url = avatar_url        
    }
}
