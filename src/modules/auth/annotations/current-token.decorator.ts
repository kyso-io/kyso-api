import { Token, TokenPermissions } from '@kyso-io/kyso-model'
import { createParamDecorator, ExecutionContext, Logger } from '@nestjs/common'
import { Autowired } from '../../../decorators/autowired'
import { OrganizationsService } from '../../organizations/organizations.service'
import { TeamsService } from '../../teams/teams.service'
import { UsersService } from '../../users/users.service'
import { AuthService } from '../auth.service'
import { PlatformRoleService } from '../platform-role.service'
import { UserRoleService } from '../user-role.service'

function parseJwt(token) {
    const base64Payload = token.split('.')[1]
    const payload = Buffer.from(base64Payload, 'base64')
    return JSON.parse(payload.toString())
}

/**
 * Hack to allow injection
 */
class AuxCurrentTokenDecoratorClass {
    @Autowired({ typeName: 'UserRoleService' })
    public userRoleService: UserRoleService

    @Autowired({ typeName: 'PlatformRoleService' })
    public platformRoleService: PlatformRoleService

    @Autowired({ typeName: 'TeamsService' })
    public teamsService: TeamsService

    @Autowired({ typeName: 'UsersService' })
    public usersService: UsersService

    @Autowired({ typeName: 'OrganizationsService' })
    public organizationsService: OrganizationsService

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    constructor() {}
}

export const CurrentToken = createParamDecorator(async (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const aux: AuxCurrentTokenDecoratorClass = new AuxCurrentTokenDecoratorClass()

    try {
        if (request.headers?.authorization && request.headers.authorization.startsWith('Bearer ')) {
            const splittedToken = request.headers.authorization.split('Bearer ')
            const decodedToken = parseJwt(splittedToken[1])

            const permissions: TokenPermissions = await AuthService.buildFinalPermissionsForUser(
                decodedToken.payload.username,
                aux.usersService,
                aux.teamsService /*this.teamsService*/,
                aux.organizationsService /*this.organizationsService*/,
                aux.platformRoleService /*this.platformRoleProvider*/,
                aux.userRoleService /*this.userRoleProvider*/,
            )

            const token: Token = new Token(
                decodedToken.payload.id,
                decodedToken.payload.name,
                decodedToken.payload.username,
                decodedToken.payload.display_name,
                decodedToken.payload.email,
                decodedToken.payload.plan,
                decodedToken.payload.avatar_url,
                decodedToken.payload.location,
                decodedToken.payload.link,
                decodedToken.payload.bio,
                decodedToken.email_verified,
                decodedToken.show_captcha,
                decodedToken.payload.accounts,
                permissions,
            )

            return token
        } else {
            return null
        }
    } catch (ex) {
        Logger.error('Error at CurrentToken', ex)
        console.log(ex)
        return undefined
    }
})
