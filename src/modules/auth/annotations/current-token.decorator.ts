import { Token, TokenPermissions } from '@kyso-io/kyso-model';
import { createParamDecorator, ExecutionContext, Inject, Logger } from '@nestjs/common'
import { Autowired } from '../../../decorators/autowired';
import { CommentsService } from '../../comments/comments.service';
import { OrganizationsService } from '../../organizations/organizations.service';
import { RelationsService } from '../../relations/relations.service';
import { ReportsService } from '../../reports/reports.service';
import { TagsService } from '../../tags/tags.service';
import { TeamsService } from '../../teams/teams.service';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';
import { PlatformRoleService } from '../platform-role.service';
import { PlatformRoleMongoProvider } from '../providers/mongo-platform-role.provider';
import { UserRoleMongoProvider } from '../providers/mongo-user-role.provider';
import { UserRoleService } from '../user-role.service';

function parseJwt(token) {
    var base64Payload = token.split('.')[1];
    var payload = Buffer.from(base64Payload, 'base64');
    return JSON.parse(payload.toString());
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

    constructor() {

    }
}


export const CurrentToken = createParamDecorator( async (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const aux: AuxCurrentTokenDecoratorClass = new AuxCurrentTokenDecoratorClass();
    
    try {
        const splittedToken = request.headers.authorization.split("Bearer ")
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
            decodedToken.payload.nickname, 
            decodedToken.payload.email, 
            decodedToken.payload.plan, 
            decodedToken.payload.avatar_url,
            decodedToken.payload.location, 
            decodedToken.payload.link, 
            decodedToken.payload.bio, 
            permissions
        )

        return token
    } catch(ex) {
        Logger.error("Error at CurrentToken", ex)
        return undefined
    }

})
