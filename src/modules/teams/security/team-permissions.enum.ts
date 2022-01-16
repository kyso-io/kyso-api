export enum TeamPermissionsEnum {
    READ = 'KYSO_IO_READ_TEAM',
    CREATE = 'KYSO_IO_CREATE_TEAM',
    EDIT = 'KYSO_IO_EDIT_TEAM',
    DELETE = 'KYSO_IO_DELETE_TEAM',
    ADMIN = 'KYSO_IO_ADMIN_TEAM',
}

export const teamReaderRoleContribution = [TeamPermissionsEnum.READ]

export const teamContributorRoleContribution = [TeamPermissionsEnum.EDIT, TeamPermissionsEnum.READ]

export const teamAdminRoleContribution = [TeamPermissionsEnum.READ, TeamPermissionsEnum.EDIT, TeamPermissionsEnum.DELETE, TeamPermissionsEnum.ADMIN]

export const organizationAdminRoleContribution = [
    TeamPermissionsEnum.READ,
    TeamPermissionsEnum.EDIT,
    TeamPermissionsEnum.DELETE,
    TeamPermissionsEnum.ADMIN,
    TeamPermissionsEnum.CREATE,
]
