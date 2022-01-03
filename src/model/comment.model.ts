import { ApiProperty } from '@nestjs/swagger'
import { BaseModel } from './base.model'

export class Comment extends BaseModel {
    @ApiProperty({ format: 'faker: lorem.sentance' })
    public text: string

    @ApiProperty({ format: 'faker: datatype.uuid' })
    public user_id: string

    @ApiProperty({ format: 'faker: datatype.uuid' })
    public report_id: string

    @ApiProperty({ format: 'faker: datatype.uuid' })
    public comment_id: string

    constructor(text, user_id, report_id, comment_id) {
        super()
        this.text = text
        this.user_id = user_id
        this.report_id = report_id
        this.comment_id = comment_id
    }
}
