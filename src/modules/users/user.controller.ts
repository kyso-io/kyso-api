import { NormalizedResponseDTO, Token, User, UserDTO } from '@kyso-io/kyso-model'
import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Autowired } from '../../decorators/autowired'
import { GenericController } from '../../generic/controller.generic'
import { CurrentToken } from '../auth/annotations/current-token.decorator'
import { AuthService } from '../auth/auth.service'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { UsersService } from './users.service'

@ApiTags('user')
@ApiExtraModels(User)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('user')
export class UserController extends GenericController<User> {
    @Autowired({ typeName: 'AuthService' })
    private readonly authService: AuthService

    constructor(private readonly usersService: UsersService) {
        super()
    }

    assignReferences(user: User) {
        // user.self_url = HateoasLinker.createRef(`/users/${user.display_name}`)
    }

    // TODO: This is in /user not in /users... bad naming, and the design is poor. For now, keep as is to don't break
    // the frontend
    @Get()
    @ApiOperation({
        summary: `Get the authenticated user`,
        description: `Allows fetching content of the authenticated user`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Authenticated user data`,
        type: User,
    })
    async getAuthenticatedUser(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<UserDTO>> {
        const user: User = await this.usersService.getUserById(token.id)
        return new NormalizedResponseDTO(UserDTO.fromUser(user))
    }
}
