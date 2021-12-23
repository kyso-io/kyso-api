import { ApiProperty } from '@nestjs/swagger'
import { Hateoas } from './hateoas.model'

export class BaseModel {
    @ApiProperty({ format: 'faker: datatype.uuid' })
    public id?: string

    @ApiProperty()
    public created_at: Date

    @ApiProperty()
    public updated_at: Date
}
