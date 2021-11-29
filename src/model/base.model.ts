import { ApiProperty } from '@nestjs/swagger'
import { Hateoas } from './hateoas.model'

export class BaseModel {
    @ApiProperty()
    public created_at: Date
    @ApiProperty()
    public updated_at: Date
    @ApiProperty()
    public self_url: Hateoas
}
