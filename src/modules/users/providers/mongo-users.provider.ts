import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { db } from 'src/main'
import { MongoProvider } from 'src/providers/mongo.provider'
import { v4 as uuidv4 } from 'uuid'
import { AuthService } from 'src/modules/auth/auth.service'
import { DEFAULT_GLOBAL_ADMIN_USER, User } from 'src/model/user.model'

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

        let copycat: User = DEFAULT_GLOBAL_ADMIN_USER
        copycat.hashed_password = AuthService.hashPassword(randomPassword)
        delete copycat.password
        
        await this.create(copycat)
    }
}
