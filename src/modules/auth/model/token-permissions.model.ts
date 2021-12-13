import { ApiProperty } from '@nestjs/swagger'
import { KysoRole } from './kyso-role.model'
import { ResourcePermissions } from './resource-permissions.model'

export class TokenPermissions {
    @ApiProperty({
        isArray: true
    })
    public global?: KysoRole[]

    @ApiProperty({
        isArray: true
    })
    public teams?: ResourcePermissions[]

    @ApiProperty({
        isArray: true
    })
    public organizations?: ResourcePermissions[]
}
