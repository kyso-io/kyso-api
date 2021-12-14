import { ApiProperty } from '@nestjs/swagger'
import { CommentPermissionsEnum } from 'src/modules/comments/security/comment-permissions.enum'
import { GithubRepoPermissionsEnum } from 'src/modules/github-repos/security/github-repos-permissions.enum'
import { OrganizationPermissionsEnum } from 'src/modules/organizations/security/organization-permissions.enum'
import { ReportPermissionsEnum } from 'src/modules/reports/security/report-permissions.enum'
import { TeamPermissionsEnum } from 'src/modules/teams/security/team-permissions.enum'
import { UserPermissionsEnum } from 'src/modules/users/security/user-permissions.enum'
import { GlobalPermissionsEnum, Permissions } from 'src/security/general-permissions.enum'
import * as mongo from 'mongodb'

export class KysoRole {
    @ApiProperty({
        description: `Role identificator`,
    })
    public _id?: any

    @ApiProperty({
        description: `Role name`,
        required: true,
    })
    public name: string

    @ApiProperty({
        description: `List of permissions related to this role. See permission reference for more details`,
        required: true,
    })
    public permissions: Permissions[]

    constructor(name, permissions, _id?) {
        this.name = name
        this.permissions = permissions

        if (_id) {
            this._id = _id
        }
    }

    public static PLATFORM_ADMIN_ROLE = new KysoRole(
        'platform-admin',
        [
            GlobalPermissionsEnum.GLOBAL_ADMIN,
            CommentPermissionsEnum.ADMIN,
            CommentPermissionsEnum.CREATE,
            CommentPermissionsEnum.DELETE,
            CommentPermissionsEnum.EDIT,
            CommentPermissionsEnum.READ,
            GithubRepoPermissionsEnum.ADMIN,
            GithubRepoPermissionsEnum.CREATE,
            GithubRepoPermissionsEnum.DELETE,
            GithubRepoPermissionsEnum.EDIT,
            GithubRepoPermissionsEnum.READ,
            OrganizationPermissionsEnum.ADMIN,
            OrganizationPermissionsEnum.CREATE,
            OrganizationPermissionsEnum.DELETE,
            OrganizationPermissionsEnum.EDIT,
            OrganizationPermissionsEnum.READ,
            ReportPermissionsEnum.ADMIN,
            ReportPermissionsEnum.CREATE,
            ReportPermissionsEnum.DELETE,
            ReportPermissionsEnum.EDIT,
            ReportPermissionsEnum.READ,
            TeamPermissionsEnum.ADMIN,
            TeamPermissionsEnum.CREATE,
            TeamPermissionsEnum.DELETE,
            TeamPermissionsEnum.EDIT,
            TeamPermissionsEnum.READ,
            UserPermissionsEnum.ADMIN,
            UserPermissionsEnum.CREATE,
            UserPermissionsEnum.DELETE,
            UserPermissionsEnum.EDIT,
            UserPermissionsEnum.READ,
        ],
        new mongo.ObjectId('61a8ae8f9c2bc3c5a2144069'),
    )

    public static TEAM_ADMIN_ROLE = new KysoRole(
        'team-admin',
        [
            CommentPermissionsEnum.ADMIN,
            CommentPermissionsEnum.CREATE,
            CommentPermissionsEnum.DELETE,
            CommentPermissionsEnum.EDIT,
            CommentPermissionsEnum.READ,
            GithubRepoPermissionsEnum.ADMIN,
            GithubRepoPermissionsEnum.CREATE,
            GithubRepoPermissionsEnum.DELETE,
            GithubRepoPermissionsEnum.EDIT,
            GithubRepoPermissionsEnum.READ,
            OrganizationPermissionsEnum.READ,
            ReportPermissionsEnum.ADMIN,
            ReportPermissionsEnum.CREATE,
            ReportPermissionsEnum.DELETE,
            ReportPermissionsEnum.EDIT,
            ReportPermissionsEnum.READ,
            TeamPermissionsEnum.ADMIN,
            TeamPermissionsEnum.EDIT,
            TeamPermissionsEnum.READ,
            UserPermissionsEnum.EDIT,
            UserPermissionsEnum.READ,
        ],
        new mongo.ObjectId('61a8ae8f9c2bc3c5a2144070'),
    )

    public static TEAM_CONTRIBUTOR_ROLE = new KysoRole(
        'team-contributor',
        [
            CommentPermissionsEnum.CREATE,
            CommentPermissionsEnum.DELETE,
            CommentPermissionsEnum.EDIT,
            CommentPermissionsEnum.READ,
            GithubRepoPermissionsEnum.CREATE,
            GithubRepoPermissionsEnum.EDIT,
            GithubRepoPermissionsEnum.READ,
            OrganizationPermissionsEnum.READ,
            ReportPermissionsEnum.CREATE,
            ReportPermissionsEnum.DELETE,
            ReportPermissionsEnum.EDIT,
            ReportPermissionsEnum.READ,
            TeamPermissionsEnum.READ,
            UserPermissionsEnum.EDIT,
            UserPermissionsEnum.READ,
        ],
        new mongo.ObjectId('61a8ae8f9c2bc3c5a2144071'),
    )

    public static TEAM_READER_ROLE = new KysoRole(
        'team-reader',
        [
            CommentPermissionsEnum.READ,
            GithubRepoPermissionsEnum.READ,
            OrganizationPermissionsEnum.READ,
            ReportPermissionsEnum.READ,
            TeamPermissionsEnum.READ,
            UserPermissionsEnum.EDIT, // Always can edit his own profile
            UserPermissionsEnum.READ,
        ],
        new mongo.ObjectId('61a8ae8f9c2bc3c5a2144072'),
    )

    public static ORGANIZATION_ADMIN_ROLE = new KysoRole(
        'organization-admin',
        [
            CommentPermissionsEnum.ADMIN,
            CommentPermissionsEnum.CREATE,
            CommentPermissionsEnum.DELETE,
            CommentPermissionsEnum.EDIT,
            CommentPermissionsEnum.READ,
            GithubRepoPermissionsEnum.ADMIN,
            GithubRepoPermissionsEnum.CREATE,
            GithubRepoPermissionsEnum.DELETE,
            GithubRepoPermissionsEnum.EDIT,
            GithubRepoPermissionsEnum.READ,
            OrganizationPermissionsEnum.ADMIN,
            OrganizationPermissionsEnum.CREATE,
            OrganizationPermissionsEnum.DELETE,
            OrganizationPermissionsEnum.EDIT,
            OrganizationPermissionsEnum.READ,
            ReportPermissionsEnum.ADMIN,
            ReportPermissionsEnum.CREATE,
            ReportPermissionsEnum.DELETE,
            ReportPermissionsEnum.EDIT,
            ReportPermissionsEnum.READ,
            TeamPermissionsEnum.ADMIN,
            TeamPermissionsEnum.CREATE,
            TeamPermissionsEnum.DELETE,
            TeamPermissionsEnum.EDIT,
            TeamPermissionsEnum.READ,
            UserPermissionsEnum.CREATE,
            UserPermissionsEnum.DELETE,
            UserPermissionsEnum.EDIT,
            UserPermissionsEnum.READ,
        ],
        new mongo.ObjectId('61a8ae8f9c2bc3c5a2144073'),
    )
}
