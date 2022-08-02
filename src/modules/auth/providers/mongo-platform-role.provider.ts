import { KysoRole } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'
import { PlatformRole } from '../../../security/platform-roles'
import { PlatformRoleService } from '../platform-role.service'

@Injectable()
export class PlatformRoleMongoProvider extends MongoProvider<any> {
    version = 1

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
}
