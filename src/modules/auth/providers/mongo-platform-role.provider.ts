import { KysoRole } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'
import { PlatformRole } from '../../../security/platform-roles'
import { PlatformRoleService } from '../platform-role.service'

@Injectable()
export class PlatformRoleMongoProvider extends MongoProvider<any> {
    version = 2

    constructor() {
        super('PlatformRole', db)
        this.checkRoles()
    }

    async populateMinimalData() {
        for (const role of PlatformRole.ALL_PLATFORM_ROLES) {
            Logger.log(`Creating ${role.name} role`)
            await this.create(role);
        }
    }

    async checkRoles(): Promise<void> {
        for (const role of PlatformRole.ALL_PLATFORM_ROLES) {
            const rolesDb: KysoRole[] = await this.read({
                filter: {
                    name: role.name,
                },
            })
            if (rolesDb.length === 0) {
                await this.create(role)
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

    async migrate_from_1_to_2(): Promise<void> {
        const rolesDb: KysoRole[] = await this.read({
            filter: {
                name: PlatformRole.TEAM_READER_ROLE.name,
            },
        })

        if (rolesDb.length === 0) {
            // Error
            Logger.error("Error migrating from v1 to v2 of PlatformRole entity");
        }


        const roleDb: KysoRole = rolesDb[0]
        await this.updateOne(
            { _id: this.toObjectId(roleDb.id) },
            {
                $set: { permissions: PlatformRole.TEAM_READER_ROLE.permissions },
            },
        )
        Logger.log(`Updated role ${roleDb.name}`, PlatformRoleMongoProvider.name)
    }
}
