import { ApiProperty } from '@nestjs/swagger'
import { IsDate, IsOptional, IsUUID } from 'class-validator'

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
}
