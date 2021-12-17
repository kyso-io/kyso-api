import { ApiProperty } from '@nestjs/swagger'
import { BaseModel } from './base.model'
import { User } from './user.model'

export class Comment extends BaseModel {
    @ApiProperty({ format: 'faker: datatype.uuid' })
    public id: string

    @ApiProperty({ format: 'faker: lorem.paragraph' })
    public text: string

    @ApiProperty()
    public user: User

    @ApiProperty({ isArray: true })
    comments: Comment

    @ApiProperty()
    public _p_study: any
}
