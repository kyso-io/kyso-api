import { ApiExtraModels, ApiProperty } from '@nestjs/swagger'
import { BatchReportCreation } from 'src/model/dto/batch-report-creation-response.dto'
import { BaseModel } from './base.model'
import { Comment } from './comment.model'

@ApiExtraModels(BatchReportCreation)
export class Report extends BaseModel {
    @ApiProperty()
    public name: string
    // @ApiProperty()
    // public views: number
    // @ApiProperty()
    // public stars: number
    // @ApiProperty()
    // public number_of_comments: number

    // We can keep some fields without typing if we want as well
    // @ApiProperty()
    // public analytics: any
    // @ApiProperty()
    // public provider: any

    @ApiProperty({ format: 'faker: datatype.uuid' })
    public comment_ids: [string]

    @ApiProperty({ format: 'faker: datatype.uuid' })
    public user_id: string
}
