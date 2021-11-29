import { ApiProperty } from '@nestjs/swagger'

export class UpdateTeamRequest {
    @ApiProperty()
    public location: string
    @ApiProperty()
    public link: string
    @ApiProperty()
    public bio: string
}
