import { ApiProperty } from '@nestjs/swagger'

export class Branch {
    @ApiProperty()
    public name: string
    @ApiProperty()
    public commit: string
    @ApiProperty()
    public is_default: boolean
}
