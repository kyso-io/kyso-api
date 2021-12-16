import { Injectable, Logger } from '@nestjs/common'
import { MongoProvider } from 'src/providers/mongo.provider'
import { db } from 'src/main'
import { Organization } from 'src/model/organization.model'

@Injectable()
export class OrganizationsMongoProvider extends MongoProvider<Organization> {
    constructor() {
        super('Organization', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }
}
