import { GlobalPermissionsEnum, LoginProviderEnum, User } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import * as mongo from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'
import { AuthService } from '../../auth/auth.service'

const DEFAULT_GLOBAL_ADMIN_USER = new User(
    'default-admin@kyso.io',
    'default-admin@kyso.io',
    'default-admin@kyso.io',
    'default-admin',
    LoginProviderEnum.KYSO,
    '',
    'free',
    'https://bit.ly/32hyGaj',
    false,
    [GlobalPermissionsEnum.GLOBAL_ADMIN],
    '',
    '',
    new mongo.ObjectId('61a8ae8f9c2bc3c5a2144000').toString(),
)

@Injectable()
export class UsersMongoProvider extends MongoProvider<User> {
    provider: any

    constructor() {
        super('User', db)
    }

    async populateMinimalData() {
        Logger.log(`Populating minimal data for ${this.baseCollection}`)

        Logger.log(`Creating default global admin user`)
        const randomPassword = uuidv4()
        Logger.log(`
                ad8888888888ba
                dP'         \`"8b,
                8  ,aaa,       "Y888a     ,aaaa,     ,aaa,  ,aa,
                8  8' \`8           "88baadP""""YbaaadP"""YbdP""Yb
                8  8   8              """        """      ""    8b
                8  8, ,8         ,aaaaaaaaaaaaaaaaaaaaaaaaddddd88P
                8  \`"""'       ,d8""
                Yb,         ,ad8"       PASSWORD FOR default-admin@kyso.io USER IS: ${randomPassword}
                "Y8888888888P"
        `)

        const copycat: User = Object.assign({}, DEFAULT_GLOBAL_ADMIN_USER)
        copycat.hashed_password = AuthService.hashPassword(randomPassword)

        await this.create(copycat)
    }
}
