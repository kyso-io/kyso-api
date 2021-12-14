import { Injectable, Logger } from '@nestjs/common'
import { MongoProvider } from 'src/providers/mongo.provider'
import { db } from 'src/main'
import { KysoRole } from '../model/kyso-role.model'
import * as mongo from 'mongodb'
import { CommentPermissionsEnum } from 'src/modules/comments/security/comment-permissions.enum'
import { GithubRepoPermissionsEnum } from 'src/modules/github-repos/security/github-repos-permissions.enum'
import { OrganizationPermissionsEnum } from 'src/modules/organizations/security/organization-permissions.enum'
import { ReportPermissionsEnum } from 'src/modules/reports/security/report-permissions.enum'
import { TeamPermissionsEnum } from 'src/modules/teams/security/team-permissions.enum'
import { UserPermissionsEnum } from 'src/modules/users/security/user-permissions.enum'

@Injectable()
export class PlatformRoleMongoProvider extends MongoProvider {
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
