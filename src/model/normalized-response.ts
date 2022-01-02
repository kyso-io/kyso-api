import { ApiProperty } from '@nestjs/swagger'

export class BaseModel {
    @ApiProperty()
    public data: object[] | object

    @ApiProperty()
    public relationships?: object
}
