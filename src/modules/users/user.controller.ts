import { Controller, Get, Headers, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UsersService } from './users.service'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { NormalizedResponse } from '../../model/dto/normalized-reponse.dto'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { AuthService } from '../auth/auth.service'
import { User } from '../../model/user.model'
import { GenericController } from '../../generic/controller.generic'
import { Token } from '../../model/token.model'

const UPDATABLE_FIELDS = ['email', 'nickname', 'bio', 'accessToken', 'access_token']

@ApiTags('user')
@ApiExtraModels(User)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('user')
export class UserController extends GenericController<User> {
    constructor(private readonly usersService: UsersService, private readonly authService: AuthService) {
        super()
    }

    assignReferences(user: User) {
        // user.self_url = HateoasLinker.createRef(`/users/${user.nickname}`)
    }

    // TODO: This is in /user not in /users... bad naming, and the design is poor. For now, keep as is to don't break
    // the frontend
    @Get('')
    @ApiOperation({
        summary: `Get the authenticated user`,
        description: `Allows fetching content of the authenticated user`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Authenticated user data`,
        type: User,
    })
    async getAuthenticatedUser(@Headers('authorization') authorizationHeader: string) {
        const splittedToken = authorizationHeader.split('Bearer ')[1]

        const token: Token = this.authService.evaluateAndDecodeToken(splittedToken)

        const user = await this.usersService.getUser({ filter: { username: token.username } })
        return new NormalizedResponse(user)
    }
}
