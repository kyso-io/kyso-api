import { ApiProperty } from '@nestjs/swagger'
import { BaseModel } from './base.model'

export class Comment extends BaseModel {
    @ApiProperty({ format: 'faker: lorem.sentance' })
    public text: string

    @ApiProperty({ format: 'faker: datatype.uuid' })
    public user_rel: string

    @ApiProperty({ format: 'faker: datatype.uuid' })
    public report_rel: string

    @ApiProperty({ format: 'faker: datatype.uuid' })
    public comments_rel: [string]
}
