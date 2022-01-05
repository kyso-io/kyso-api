export enum ReportPermissionsEnum {
    READ = 'KYSO_IO_READ_REPORT',
    CREATE = 'KYSO_IO_CREATE_REPORT',
    EDIT = 'KYSO_IO_EDIT_REPORT',
    DELETE = 'KYSO_IO_DELETE_REPORT',
    ADMIN = 'KYSO_IO_ADMIN_REPORT',
}

export const reportPermissionsEnumList: ReportPermissionsEnum[] = [
    ReportPermissionsEnum.READ,
    ReportPermissionsEnum.CREATE,
    ReportPermissionsEnum.EDIT,
    ReportPermissionsEnum.DELETE,
    ReportPermissionsEnum.ADMIN,
]
