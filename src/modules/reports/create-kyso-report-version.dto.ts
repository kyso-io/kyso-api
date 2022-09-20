import { ApiProperty } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { IsArray, IsInt, IsMongoId, IsPositive } from 'class-validator'
import { IsFile, MemoryStoredFile } from 'nestjs-form-data'

export class CreateKysoReportVersionDto {
    @ApiProperty()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    public version: number

    @ApiProperty()
    @Transform(({ value }) => {
        try {
            return JSON.parse(value)
        } catch (e) {
            return []
        }
    })
    @IsArray()
    @IsMongoId({ each: true })
    public unmodifiedFiles: string[]
    
    @ApiProperty()
    @Transform(({ value }) => {
        try {
            return JSON.parse(value)
        } catch (e) {
            return []
        }
    })
    @IsArray()
    @IsMongoId({ each: true })
    public deletedFiles: string[]

    @IsFile()
    public file: MemoryStoredFile
}
