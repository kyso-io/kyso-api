import { ApiProperty } from '@nestjs/swagger'
import { KysoRole } from './kyso-role.model'

export class ResourcePermissions {
    @ApiProperty()
    public name: string

    @ApiProperty()
    public id: string

    @ApiProperty({
        isArray: true,
        description: "List of roles applied to that resource",
        enum: KysoRole
    })
    public permissions: KysoRole[]
}
