import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { Organization } from '../../../model/organization.model'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class OrganizationsMongoProvider extends MongoProvider<Organization> {
    constructor() {
        super('Organization', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }
}
