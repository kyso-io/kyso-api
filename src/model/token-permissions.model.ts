import { ApiProperty } from '@nestjs/swagger'
import { GlobalPermissionsEnum } from '../security/general-permissions.enum'
import { ResourcePermissions } from './resource-permissions.model'

export class TokenPermissions {
    @ApiProperty({
        isArray: true,
    })
    public global?: GlobalPermissionsEnum[]

    @ApiProperty({
        isArray: true,
    })
    public teams?: ResourcePermissions[]

    @ApiProperty({
        isArray: true,
    })
    public organizations?: ResourcePermissions[]
}
