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
    '',
    '',
    'free',
    'https://bit.ly/32hyGaj',
    null,
    false,
    [GlobalPermissionsEnum.GLOBAL_ADMIN],
    '',
    '',
    new mongo.ObjectId('61a8ae8f9c2bc3c5a2144000').toString(),
)
@Injectable()
export class UsersMongoProvider extends MongoProvider<User> {
    provider: any
    version = 4

    constructor() {
        super('User', db, [
            {
                keys: {
                    email: 'text',
                    username: 'text',
                    name: 'text',
                    display_name: 'text',
                },
            },
        ])
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

    /**
     * Refactored properties:
     *     - nickname to display_name
     *
     * This migration do:
     *     - Iterates through every document in Users collection
     *     - For each of them:
     *         - Read nickname and name properties
     *         - Adds a new display_name property with nickname value
     *
     * This migration DOES NOT DELETE name nor nickname, to be backwards compatible, but these properties are deprecated and will be deleted in next migrations
     *
     */
    async migrate_from_1_to_2() {
        const cursor = await this.getCollection().find({})
        const allUsers: any[] = await cursor.toArray()

        for (let user of allUsers) {
            const data: any = {
                display_name: user.nickname,
            }

            await this.update(
                { _id: this.toObjectId(user.id) },
                {
                    $set: data,
                },
            )
        }

        // This is made automatically, so don't need to add it explicitly
        // await this.saveModelVersion(2)
    }

    async migrate_from_2_to_3() {
        const cursor = await this.getCollection().find({})
        const allUsers: any[] = await cursor.toArray()
        for (let user of allUsers) {
            const data: any = {
                show_captcha: true,
            }
            await this.update(
                { _id: this.toObjectId(user.id) },
                {
                    $set: data,
                },
            )
        }
    }

    async migrate_from_3_to_4() {
        const cursor = await this.getCollection().find({})
        const allUsers: any[] = await cursor.toArray()
        for (let user of allUsers) {
            const data: any = {
                background_image_url: null,
            }
            await this.update(
                { _id: this.toObjectId(user.id) },
                {
                    $set: data,
                },
            )
        }
    }
}
