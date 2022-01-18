import { OrganizationMemberJoin } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class OrganizationMemberMongoProvider extends MongoProvider<any> {
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
