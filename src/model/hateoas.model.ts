import { ApiProperty } from '@nestjs/swagger'

export class Hateoas {
    @ApiProperty()
    public self_api: string

    @ApiProperty()
    public self_ui: string
}
