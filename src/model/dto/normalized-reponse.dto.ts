import { ApiProperty } from '@nestjs/swagger'

export class NormalizedResponse {
    data

    @ApiProperty()
    relations: object[]

    constructor(data, relations = null) {
        this.data = data
        this.relations = relations
    }
}
