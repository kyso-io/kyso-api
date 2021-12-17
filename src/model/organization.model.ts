import { ApiProperty } from '@nestjs/swagger'
import { KysoRole } from 'src/modules/auth/model/kyso-role.model'
import { BaseModel } from './base.model'
import { Exclude } from 'class-transformer'

export class Organization extends BaseModel {
    @ApiProperty({ format: 'faker: datatype.uuid' })
    public id?: string

    @ApiProperty()
    public name: string

    // TODO: test
    @Exclude()
    @ApiProperty({
        required: true,
        type: KysoRole,
        isArray: true,
    })
    public roles: KysoRole[]
}
