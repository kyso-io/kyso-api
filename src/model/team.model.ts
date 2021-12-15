import { ApiProperty } from '@nestjs/swagger'
import { KysoRole } from 'src/modules/auth/model/kyso-role.model'
import { BaseModel } from './base.model'

export class Team extends BaseModel {
    @ApiProperty({ format: 'faker: random.uuid' })
    public id: string

    @ApiProperty()
    public name: string
    @ApiProperty()
    public avatar_url: string
    @ApiProperty()
    public bio: string
    @ApiProperty()
    public link: string
    @ApiProperty()
    public location: string

    @ApiProperty({
        required: true,
        type: KysoRole,
        isArray: true,
    })
    public roles: KysoRole[]
}
