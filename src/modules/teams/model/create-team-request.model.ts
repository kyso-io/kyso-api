import { ApiProperty } from '@nestjs/swagger'
import { KysoRole } from 'src/modules/auth/model/kyso-role.model'

export class CreateTeamRequest {
    @ApiProperty()
    public name: string
    
    @ApiProperty({
        required: true,
        type: KysoRole,
        isArray: true,
    })
    public roles: KysoRole[]

    constructor(name, roles) {
        this.name = name
        this.roles = roles
    }
}
