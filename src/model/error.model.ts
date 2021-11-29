import { ApiProperty } from '@nestjs/swagger'

export class Error {
    @ApiProperty()
    public error: string
}
