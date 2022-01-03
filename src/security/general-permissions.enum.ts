import { CommentPermissionsEnum } from "../modules/comments/security/comment-permissions.enum";
import { GithubRepoPermissionsEnum } from "../modules/github-repos/security/github-repos-permissions.enum";
import { OrganizationPermissionsEnum } from "../modules/organizations/security/organization-permissions.enum";
import { ReportPermissionsEnum } from "../modules/reports/security/report-permissions.enum";
import { TeamPermissionsEnum } from "../modules/teams/security/team-permissions.enum";
import { UserPermissionsEnum } from "../modules/users/security/user-permissions.enum";


export enum GlobalPermissionsEnum {
    GLOBAL_ADMIN = 'KYSO_IO_GENERAL_GLOBAL_ADMIN',
}

export type Permissions =
    | GlobalPermissionsEnum
    | CommentPermissionsEnum
    | OrganizationPermissionsEnum
    | ReportPermissionsEnum
    | TeamPermissionsEnum
    | UserPermissionsEnum
    | GithubRepoPermissionsEnum
