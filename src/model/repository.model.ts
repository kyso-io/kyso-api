import { ApiProperty } from '@nestjs/swagger'
import { BaseModel } from './base.model'
import { Hateoas } from './hateoas.model'

export class Repository {
    @ApiProperty()
    public id: number

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
    @ApiProperty()
    public tree_url: Hateoas
    @ApiProperty()
    public report_url: Hateoas

    // Does not appear in the documentation...
    @ApiProperty()
    public self_url: Hateoas
}
