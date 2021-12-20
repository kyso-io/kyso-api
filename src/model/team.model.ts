import { ApiProperty } from '@nestjs/swagger'
import { KysoRole } from 'src/modules/auth/model/kyso-role.model'
import { BaseModel } from './base.model'
import { Organization } from './organization.model'

export class Team extends BaseModel {
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

    @ApiProperty({
        required: false,
        type: Organization
    })
    public organization?: Organization

    @ApiProperty({
        required: true
    })
    public organization_id: string

    constructor(name: string, avatar_url: string, bio: string, location: string, roles: KysoRole[], 
        organization_id: string, id?: string, organization?: Organization) {
        super()
        
        this.name = name
        this.avatar_url = avatar_url
        this.bio = bio
        this.location = location
        this.roles = roles
        this.organization_id = organization_id

        if(organization) {
            this.organization = organization
        }

        if(id) {
            this.id = id
        }
    }
}
