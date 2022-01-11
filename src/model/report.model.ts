import { ApiExtraModels, ApiProperty } from '@nestjs/swagger'
import { plainToClass } from 'class-transformer'
import { BaseModel } from './base.model'
import { BatchReportCreation } from './dto/batch-report-creation-response.dto'

@ApiExtraModels(BatchReportCreation)
export class Report extends BaseModel {
    @ApiProperty()
    public name: string

    @ApiProperty()
    public type: 'report'

    @ApiProperty()
    public views: number

    @ApiProperty()
    public stars: number

    @ApiProperty()
    public number_of_comments: number

    // We can keep some fields without typing if we want as well
    @ApiProperty()
    public analytics: any

    @ApiProperty()
    public provider: any

    @ApiProperty()
    public source: any

    @ApiProperty()
    public pin: boolean

    @ApiProperty({ format: 'faker: datatype.uuid' })
    public user_id: string

    @ApiProperty({ format: 'faker: datatype.uuid' })
    public comment_ids: [string]

    @ApiProperty({ format: 'faker: datatype.uuid' })
    public team_id: string

    public buildHatoes(relations?) {
        const user = relations.user[this.user_id]

        this.links = {
            self_api: `/${user.nickname}/${this.name}`,
            self_ui: `/${user.nickname}/${this.name}`,
        }
    }

    public static fromObject(obj: any): Report {
        return plainToClass(Report, obj)
    }

    public static fromObjectArray(array: any[]): Report[] {
        return array.map(x => Report.fromObject(x))
    }
}
