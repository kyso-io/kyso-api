import { ApiProperty } from '@nestjs/swagger'
import { IsDate, IsOptional, IsUUID } from 'class-validator'
import { Hateoas } from './hateoas.model'

export class BaseModel {
    @IsUUID()
    @IsOptional()
    @ApiProperty({ format: 'faker: datatype.uuid' })
    public id?: string

    @IsDate()
    @ApiProperty()
    public created_at: Date

    @IsDate()
    @IsOptional()
    @ApiProperty()
    public updated_at?: Date

    @ApiProperty()
    public self_url: Hateoas
}
