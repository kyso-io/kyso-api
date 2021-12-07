import { ApiProperty } from '@nestjs/swagger'

export class TeamMember {
    @ApiProperty()
    public id: string
    @ApiProperty()
    public nickname: string
    @ApiProperty()
    public username: string
    @ApiProperty()
    public team_roles: string[]
    @ApiProperty()
    public bio: string
    @ApiProperty()
    public avatar_url: string
    @ApiProperty()
    public email: string
}
