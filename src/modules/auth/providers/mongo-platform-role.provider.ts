import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { KysoRole } from '../../../model/kyso-role.model'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class PlatformRoleMongoProvider extends MongoProvider<any> {
    constructor() {
        super('PlatformRole', db)
    }

    async populateMinimalData() {
        Logger.log(`Creating platform-admin role`)
        await this.create(KysoRole.PLATFORM_ADMIN_ROLE)

        Logger.log(`Creating team-admin role`)
        await this.create(KysoRole.TEAM_ADMIN_ROLE)

        Logger.log(`Creating team-contributor role`)
        await this.create(KysoRole.TEAM_CONTRIBUTOR_ROLE)

        Logger.log(`Creating team-reader role`)
        await this.create(KysoRole.TEAM_READER_ROLE)

        Logger.log(`Creating organization-admin role`)
        await this.create(KysoRole.ORGANIZATION_ADMIN_ROLE)
    }
}
