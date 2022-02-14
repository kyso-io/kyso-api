import { User } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'
import { AuthService } from '../../auth/auth.service'


@Injectable()
export class UsersAccessTokensMongoProvider extends MongoProvider<User> {
    provider: any

    constructor() {
        super('UserAccessToken', db)
    }

    async populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }
}
