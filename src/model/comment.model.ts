import { ApiProperty } from '@nestjs/swagger'
import { IsMongoId, IsNotEmpty, IsOptional } from 'class-validator'
import { BaseModel } from './base.model'

export class Comment extends BaseModel {
    @ApiProperty({ format: 'faker: lorem.sentance' })
    @IsNotEmpty()
    public text: string

    @ApiProperty({ format: 'faker: datatype.uuid' })
    public user_id: string

    @ApiProperty({ format: 'faker: lorem.sentance' })
    public username: string

    @ApiProperty({ format: 'faker: datatype.uuid' })
    @IsMongoId()
    public report_id: string

    @ApiProperty({ format: 'faker: datatype.uuid' })
    @IsOptional()
    @IsMongoId()
    public comment_id: string

    @ApiProperty()
    public type: 'comment'

    buildHatoes(relations?: any) {}

    constructor(text, user_id, report_id, comment_id) {
        super()
        this.text = text
        this.user_id = user_id
        this.report_id = report_id
        this.comment_id = comment_id
        this.username = username
    }
}
