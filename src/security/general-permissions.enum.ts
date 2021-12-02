import { CommentPermissionsEnum } from "src/modules/comments/security/comment-permissions.enum";
import { OrganizationPermissionsEnum } from "src/modules/organizations/security/organization-permissions.enum";
import { ReportPermissionsEnum } from "src/modules/reports/security/report-permissions.enum";
import { TeamPermissionsEnum } from "src/modules/teams/security/team-permissions.enum";
import { UserPermissionsEnum } from "src/modules/users/security/user-permissions.enum";

export enum GeneralPermissionsEnum {
    LOGIN = 'KYSO_IO_GENERAL_LOGIN',
    GLOBAL_ADMIN = 'KYSO_IO_GENERAL_GLOBAL_ADMIN'
}

export type Permissions = GeneralPermissionsEnum | CommentPermissionsEnum | OrganizationPermissionsEnum |
                          ReportPermissionsEnum | TeamPermissionsEnum | UserPermissionsEnum
