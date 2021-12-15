import { ApiProperty } from '@nestjs/swagger'

export class TeamMemberJoin {
    @ApiProperty()
    public team_id: string
    @ApiProperty()
    public member_id: string
    @ApiProperty()
    public role_names: string[]
    @ApiProperty()
    public active: boolean
    @ApiProperty()
    public id: string
}