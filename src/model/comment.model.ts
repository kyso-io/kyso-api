import { ApiProperty } from '@nestjs/swagger'
import { BaseModel } from './base.model'
import { Hateoas } from './hateoas.model'

export class Comment extends BaseModel {
    @ApiProperty({ format: 'faker: random.uuid' })
    public id: string
    @ApiProperty({ format: 'faker: lorem.paragraph' })
    public text: string
    @ApiProperty()
    public _p_user: string
    @ApiProperty()
    public child_comments: Comment[]
}
