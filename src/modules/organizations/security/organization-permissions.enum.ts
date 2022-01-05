export enum OrganizationPermissionsEnum {
    READ = 'KYSO_IO_READ_ORGANIZATION',
    CREATE = 'KYSO_IO_CREATE_ORGANIZATION',
    EDIT = 'KYSO_IO_EDIT_ORGANIZATION',
    DELETE = 'KYSO_IO_DELETE_ORGANIZATION',
    ADMIN = 'KYSO_IO_ADMIN_ORGANIZATION',
}

export const organizationPermissionsEnumList: OrganizationPermissionsEnum[] = [
    OrganizationPermissionsEnum.READ,
    OrganizationPermissionsEnum.CREATE,
    OrganizationPermissionsEnum.EDIT,
    OrganizationPermissionsEnum.DELETE,
    OrganizationPermissionsEnum.ADMIN,
]
