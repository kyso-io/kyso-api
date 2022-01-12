import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class UpdateUserRequest {
    @ApiProperty()
    @IsNotEmpty()
    public nickname: string

    @ApiProperty()
    @IsString()
    public bio: string
}
