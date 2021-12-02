import { Injectable } from '@nestjs/common'
import { MongoProvider } from 'src/providers/mongo.provider'
import { OrganizationMemberJoin } from '../model/organization-member-join.model'

@Injectable()
export class OrganizationMemberMongoProvider extends MongoProvider {
    constructor() {
        super('OrganizationMember')
    }

    async getMembers(organizationId: string): Promise<OrganizationMemberJoin[]> {
        const allMembers = await this.read({ filter: { organization_id: organizationId } })
        
        return allMembers
    }
}
