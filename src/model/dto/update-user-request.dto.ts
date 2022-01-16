import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class UpdateUserRequest {
    @ApiProperty()
    @IsOptional()
    @IsNotEmpty()
    public nickname: string

    @ApiProperty()
    @IsOptional()
    @IsString()
    public bio: string

    @ApiProperty()
    @IsOptional()
    @IsString()
    public accessToken: string
}
