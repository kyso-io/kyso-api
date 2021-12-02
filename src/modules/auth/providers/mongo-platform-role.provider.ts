import { Injectable } from '@nestjs/common'
import { MongoProvider } from 'src/providers/mongo.provider'

@Injectable()
export class PlatformRoleMongoProvider extends MongoProvider {
    constructor() {
        super('PlatformRole')
    }
}
