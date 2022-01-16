export enum CommentPermissionsEnum {
    READ = 'KYSO_IO_READ_COMMENT',
    CREATE = 'KYSO_IO_CREATE_COMMENT',
    EDIT = 'KYSO_IO_EDIT_COMMENT',
    DELETE = 'KYSO_IO_DELETE_COMMENT',
    ADMIN = 'KYSO_IO_ADMIN_COMMENT',
}

export const commentPermissionsEnumsList: CommentPermissionsEnum[] = [
    CommentPermissionsEnum.READ,
    CommentPermissionsEnum.CREATE,
    CommentPermissionsEnum.EDIT,
    CommentPermissionsEnum.DELETE,
    CommentPermissionsEnum.ADMIN,
]
