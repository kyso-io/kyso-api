import { ApiProperty } from '@nestjs/swagger'
import { KysoRole } from 'src/modules/auth/model/kyso-role.model'

export class CreateOrganizationRequest {
    @ApiProperty()
    public name: string

    @ApiProperty({
        required: true,
        type: KysoRole,
        isArray: true,
    })
    public roles: KysoRole[]
}
