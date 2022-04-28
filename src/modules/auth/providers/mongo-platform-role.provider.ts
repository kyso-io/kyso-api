import { KysoRole } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'
import { PlatformRole } from '../../../security/platform-roles'

@Injectable()
export class PlatformRoleMongoProvider extends MongoProvider<any> {
    version = 1

    constructor() {
        super('PlatformRole', db)
        this.checkRoles()
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

    async checkRoles(): Promise<void> {
        const roles: KysoRole[] = [
            PlatformRole.PLATFORM_ADMIN_ROLE,
            PlatformRole.TEAM_ADMIN_ROLE,
            PlatformRole.TEAM_CONTRIBUTOR_ROLE,
            PlatformRole.TEAM_READER_ROLE,
            PlatformRole.ORGANIZATION_ADMIN_ROLE,
        ]
        for (const role of roles) {
            const rolesDb: KysoRole[] = await this.read({
                filter: {
                    name: role.name,
                },
            })
            if (rolesDb.length === 0) {
                continue
            }
            const roleDb: KysoRole = rolesDb[0]
            await this.updateOne(
                { _id: this.toObjectId(roleDb.id) },
                {
                    $set: { permissions: role.permissions },
                },
            )
            Logger.log(`Updated role ${role.name}`, PlatformRoleMongoProvider.name)
        }
    }
}
