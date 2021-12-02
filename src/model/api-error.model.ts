import { ApiProperty } from '@nestjs/swagger'

export class ApiError {
    @ApiProperty()
    public statusCode: number

    @ApiProperty()
    public message: string
    
    @ApiProperty()
    public error: string
}
