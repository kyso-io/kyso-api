import { ApiProperty } from '@nestjs/swagger'

export class NormalizedResponse {
    data: any | any[]

    @ApiProperty()
    relations: object[]

    constructor(data, relations?) {
        this.data = data
        this.relations = relations
    }
}
