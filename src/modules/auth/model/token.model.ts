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
}
