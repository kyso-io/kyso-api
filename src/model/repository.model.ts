import { ApiProperty } from '@nestjs/swagger'

export class Repository {
    @ApiProperty()
    public owner: string
    @ApiProperty()
    public name: string
    @ApiProperty()
    public full_name: string
    @ApiProperty()
    public default_branch: string
    @ApiProperty()
    public description: string
    @ApiProperty()
    public is_private: boolean
    @ApiProperty()
    public language: string
    @ApiProperty()
    public pushed_at: Date
}
