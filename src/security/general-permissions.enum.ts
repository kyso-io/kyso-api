import { CommentPermissionsEnum, commentPermissionsEnumsList } from '../modules/comments/security/comment-permissions.enum'
import { GithubRepoPermissionsEnum } from '../modules/github-repos/security/github-repos-permissions.enum'
import { OrganizationPermissionsEnum, organizationPermissionsEnumList } from '../modules/organizations/security/organization-permissions.enum'
import { ReportPermissionsEnum, reportPermissionsEnumList } from '../modules/reports/security/report-permissions.enum'
import { organizationAdminRoleContribution, TeamPermissionsEnum } from '../modules/teams/security/team-permissions.enum'
import { UserPermissionsEnum, userPermissionsEnumList } from '../modules/users/security/user-permissions.enum'

export enum GlobalPermissionsEnum {
    GLOBAL_ADMIN = 'KYSO_IO_GENERAL_GLOBAL_ADMIN',
}

export const globalPermissionsEnumList: GlobalPermissionsEnum[] = [GlobalPermissionsEnum.GLOBAL_ADMIN]

export type KysoPermissions =
    | GlobalPermissionsEnum
    | CommentPermissionsEnum
    | OrganizationPermissionsEnum
    | ReportPermissionsEnum
    | TeamPermissionsEnum
    | UserPermissionsEnum
    | GithubRepoPermissionsEnum

export const kysoPermissionsList: KysoPermissions[] = [
    ...globalPermissionsEnumList,
    ...commentPermissionsEnumsList,
    ...organizationPermissionsEnumList,
    ...reportPermissionsEnumList,
    ...organizationAdminRoleContribution,
    ...userPermissionsEnumList,
    ...userPermissionsEnumList,
]
