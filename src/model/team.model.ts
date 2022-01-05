import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'
import { BaseModel } from './base.model'
import { TeamVisibilityEnum } from './enum/team-visibility.enum'
import { KysoRole } from './kyso-role.model'

export class Team extends BaseModel {
    @ApiProperty()
    @IsString()
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
        required: true,
        enum: TeamVisibilityEnum,
    })
    public visibility: TeamVisibilityEnum

    @ApiProperty({
        required: true,
    })
    public organization_id: string

    constructor(
        name: string,
        avatar_url: string,
        bio: string,
        location: string,
        roles: KysoRole[],
        organization_id: string,
        visibility: TeamVisibilityEnum,
        id?: string,
    ) {
        super()

        this.name = name
        this.avatar_url = avatar_url
        this.bio = bio
        this.location = location
        this.roles = roles
        this.organization_id = organization_id
        this.visibility = visibility

        if (id) {
            this.id = id
        }
    }
}
