import { ApiProperty } from '@nestjs/swagger'
import { Permissions } from 'src/security/general-permissions.enum'

export class KysoRole {
    @ApiProperty({
        description: `Role name`,
        required: true,
    })
    public name: string
    
    @ApiProperty({
        description: `List of permissions related to this role. See permission reference for more details`,
        required: true,
    })
    public permissions: Permissions[]
}
