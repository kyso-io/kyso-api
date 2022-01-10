import { ApiProperty } from '@nestjs/swagger'
import { IsDate, IsOptional, IsUUID } from 'class-validator'
import { Hateoas } from './hateoas.model'

export class BaseModel {
    @ApiProperty()
    public type?: string

    @IsUUID()
    @IsOptional()
    @ApiProperty({ format: 'faker: datatype.uuid' })
    public id?: string

    @IsDate()
    @IsOptional()
    @ApiProperty()
    public created_at?: Date

    @IsDate()
    @IsOptional()
    @ApiProperty()
    public updated_at?: Date

    @ApiProperty({
        default: {},
    })
    public links: Hateoas

    public buildHatoes(relations?) {}
}
