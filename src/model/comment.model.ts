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
    public parent_comment_rel: string

    constructor(text, user_rel, report_rel, parent_comment_rel) {
        super()
        this.text = text
        this.user_rel = user_rel
        this.report_rel = report_rel
        this.parent_comment_rel = parent_comment_rel
    }
}
