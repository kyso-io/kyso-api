import { Token } from '../model/token.model'
import { KysoPermissions } from '../security/general-permissions.enum'

export const userHasPermission = (token: Token, kysoPermission: KysoPermissions): boolean => {
    if (token.permissions.global) {
        if ((token.permissions.global as string[]).includes(kysoPermission)) {
            return true
        }
    }
    if (token.permissions.teams) {
        for (const resourcePermission of token.permissions.teams) {
            if (resourcePermission?.permissions) {
                for (const permission of resourcePermission.permissions) {
                    if ((permission.permissions as string[]).includes(kysoPermission)) {
                        return true
                    }
                }
            }
        }
    }
    if (token.permissions.organizations) {
        for (const resourcePermission of token.permissions.organizations) {
            if (resourcePermission?.permissions) {
                for (const permission of resourcePermission.permissions) {
                    if ((permission.permissions as string[]).includes(kysoPermission)) {
                        return true
                    }
                }
            }
        }
    }
    return false
}
