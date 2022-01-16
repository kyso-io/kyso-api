import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty } from 'class-validator'
import * as mongo from 'mongodb'
import { CommentPermissionsEnum } from '../modules/comments/security/comment-permissions.enum'
import { GithubRepoPermissionsEnum } from '../modules/github-repos/security/github-repos-permissions.enum'
import { OrganizationPermissionsEnum } from '../modules/organizations/security/organization-permissions.enum'
import { ReportPermissionsEnum } from '../modules/reports/security/report-permissions.enum'
import { TeamPermissionsEnum } from '../modules/teams/security/team-permissions.enum'
import { UserPermissionsEnum } from '../modules/users/security/user-permissions.enum'
import { GlobalPermissionsEnum, KysoPermissions, kysoPermissionsList } from '../security/general-permissions.enum'

export class KysoRole {
    @ApiProperty({
        description: `Role identificator`,
    })
    public id?: string

    @ApiProperty({
        description: `Role name`,
        required: true,
    })
    @IsNotEmpty()
    public name: string

    @ApiProperty({
        description: `List of permissions related to this role. See permission reference for more details`,
        required: true,
    })
    @IsEnum(kysoPermissionsList, { each: true })
    public permissions: KysoPermissions[]

    constructor(name: string, permissions: KysoPermissions[], _id?: string) {
        this.name = name
        this.permissions = permissions

        if (_id) {
            this.id = _id
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
        new mongo.ObjectId('61a8ae8f9c2bc3c5a2144069').toString(),
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
        new mongo.ObjectId('61a8ae8f9c2bc3c5a2144070').toString(),
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
        new mongo.ObjectId('61a8ae8f9c2bc3c5a2144071').toString(),
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
        new mongo.ObjectId('61a8ae8f9c2bc3c5a2144072').toString(),
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
        new mongo.ObjectId('61a8ae8f9c2bc3c5a2144073').toString(),
    )
}
