import { KysoRole } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'
import { PlatformRole } from '../../../security/platform-roles'


@Injectable()
export class PlatformRoleMongoProvider extends MongoProvider<any> {
    constructor() {
        super('PlatformRole', db)
    }

    async populateMinimalData() {
        Logger.log(`Creating platform-admin role`)
        await this.create(PlatformRole.PLATFORM_ADMIN_ROLE)

        Logger.log(`Creating team-admin role`)
        await this.create(PlatformRole.TEAM_ADMIN_ROLE)

        Logger.log(`Creating team-contributor role`)
        await this.create(PlatformRole.TEAM_CONTRIBUTOR_ROLE)

        Logger.log(`Creating team-reader role`)
        await this.create(PlatformRole.TEAM_READER_ROLE)

        Logger.log(`Creating organization-admin role`)
        await this.create(PlatformRole.ORGANIZATION_ADMIN_ROLE)
    }
}
