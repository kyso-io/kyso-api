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

    constructor(team_id: string, member_id: string, role_names: string[], active: boolean, id?: string) {
        this.team_id = team_id
        this.member_id = member_id
        this.role_names = role_names
        this.active = active
        
        if(id) {
            this.id = id
        }
    }
}
