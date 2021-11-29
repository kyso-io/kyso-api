import { ApiExtraModels, ApiProperty } from '@nestjs/swagger'
import { BatchReportCreation } from 'src/modules/reports/model/dto/batch-report-creation-response.dto'
import { BaseModel } from './base.model'
import { Hateoas } from './hateoas.model'

@ApiExtraModels(BatchReportCreation)
export class Report extends BaseModel {
    @ApiProperty()
    public id: string

    @ApiProperty()
    public name: string
    @ApiProperty()
    public views: number
    @ApiProperty()
    public _p_user: string

    @ApiProperty()
    public stars: number
    @ApiProperty()
    public number_of_comments: number

    // We can keep some fields without typing if we want as well
    @ApiProperty()
    public analytics: any
    @ApiProperty()
    public provider: any

    // Hateoas stuff
    @ApiProperty()
    public html_url: Hateoas
    @ApiProperty()
    public branches_url: Hateoas
    @ApiProperty()
    public tree_url: Hateoas
    @ApiProperty()
    public commits_url: Hateoas
}
