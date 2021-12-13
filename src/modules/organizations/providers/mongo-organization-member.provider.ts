import { Injectable, Logger } from '@nestjs/common'
import { MongoProvider } from 'src/providers/mongo.provider'
import { OrganizationMemberJoin } from '../model/organization-member-join.model'
import { db } from 'src/main'

@Injectable()
export class OrganizationMemberMongoProvider extends MongoProvider {
    constructor() {
        super('OrganizationMember', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }

    async getMembers(organizationId: string): Promise<OrganizationMemberJoin[]> {
        const allMembers = await this.read({ filter: { organization_id: organizationId } })

        return allMembers
    }
}
