import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsBoolean, IsEmail, IsNotEmpty, ValidateNested } from 'class-validator'
import { BaseModel } from './base.model'
import { KysoRole } from './kyso-role.model'

export class Organization extends BaseModel {
    @IsNotEmpty()
    public name: string

    @ApiProperty({
        required: true,
        type: KysoRole,
        isArray: true,
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => KysoRole)
    public roles: KysoRole[]

    @ApiProperty({
        description: 'Mail where the billing communications will go',
    })
    @IsEmail()
    public billingEmail: string

    @ApiProperty({
        description: 'Stripe identificator for payments',
    })
    public subscriptionId: string

    @ApiProperty({
        description: 'Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it',
        default: true,
    })
    @IsBoolean()
    public allowGoogleLogin: boolean

    @ApiProperty()
    public type: 'organization'

    buildHatoes(relations?: any) {}

    constructor(name: string, roles: KysoRole[], billingEmail: string, subscriptionId: string, allowGoogleLogin: boolean, id?: string) {
        super()

        this.name = name
        this.roles = roles
        this.billingEmail = billingEmail
        this.subscriptionId = subscriptionId
        this.allowGoogleLogin = allowGoogleLogin
        if (id) {
            this.id = id
        }
    }
}
