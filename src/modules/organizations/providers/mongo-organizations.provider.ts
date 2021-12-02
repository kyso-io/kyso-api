import { Injectable } from '@nestjs/common'
import { MongoProvider } from 'src/providers/mongo.provider'

@Injectable()
export class OrganizationsMongoProvider extends MongoProvider {
    constructor() {
        super('Organization')
    }

}
