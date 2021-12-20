import { ApiProperty } from '@nestjs/swagger'
import { KysoRole } from 'src/modules/auth/model/kyso-role.model'
import { BaseModel } from './base.model'
import { Exclude } from 'class-transformer'

export class Organization extends BaseModel {
    @ApiProperty()
    public name: string

    @Exclude()
    @ApiProperty({
        required: true,
        type: KysoRole,
        isArray: true,
    })
    public roles: KysoRole[]

    @ApiProperty({
        description: 'Mail where the billing communications will go',
    })
    public billingEmail: string

    @ApiProperty({
        description: 'Stripe identificator for payments',
    })
    public subscriptionId: string

    @ApiProperty({
        description: 'Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it',
        default: true,
    })
    public allowGoogleLogin: boolean

    constructor(name: string, roles: KysoRole[], billingEmail: string, subscriptionId: string, allowGoogleLogin: boolean, id?: string) {
        super()

        this.name = name
        this.roles = roles
        this.billingEmail = billingEmail
        this.subscriptionId = subscriptionId
        this.allowGoogleLogin = allowGoogleLogin

        if(id) {
            this.id = id
        }
        
    }
}
