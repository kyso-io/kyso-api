import { ApiProperty } from '@nestjs/swagger'

export class OrganizationMemberJoin {
    @ApiProperty()
    public organization_id: string
    @ApiProperty()
    public member_id: string
    @ApiProperty()
    public role_names: string[]
    @ApiProperty()
    public active: boolean
    @ApiProperty()
    public id: string
}
