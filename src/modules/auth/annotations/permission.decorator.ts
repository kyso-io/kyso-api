import { SetMetadata } from '@nestjs/common'

export const PERMISSION_KEY = 'permission'
export const Permission = (permission: any) => SetMetadata(PERMISSION_KEY, permission)
