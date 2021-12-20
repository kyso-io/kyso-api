import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { UsersService } from './users.service'
import { GenericController } from 'src/generic/controller.generic'
import { HateoasLinker } from 'src/helpers/hateoasLinker'
import { QueryParser } from 'src/helpers/queryParser'
import { User } from 'src/model/user.model'
import { BaseFilterQuery } from 'src/model/dto/base-filter.dto'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { UserPermissionsEnum } from './security/user-permissions.enum'
import { Permission } from '../auth/annotations/permission.decorator'
import { CreateUserRequest } from './dto/create-user-request.dto'
import { OrganizationsService } from '../organizations/organizations.service'
import { AuthService } from '../auth/auth.service'

const UPDATABLE_FIELDS = ['email', 'nickname', 'bio', 'accessToken', 'access_token']

@ApiTags('users')
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('users')
export class UsersController extends GenericController<User> {
    constructor(
        private readonly usersService: UsersService,
        private readonly organizationService: OrganizationsService,
        private readonly authService: AuthService,
    ) {
        super()
    }

    assignReferences(user: User) {
        user.self_url = HateoasLinker.createRef(`/users/${user.nickname}`)
    }

    @Get('/')
    @ApiOperation({
        summary: `Search and fetch users`,
        description: `By passing the appropiate parameters you can fetch and filter the users of the platform.
            **This endpoint supports filtering**. Refer to the User schema to see available options.`,
    })
    @ApiResponse({
        status: 200,
        description: `Users matching criteria`,
        type: User,
    })
    @Permission([UserPermissionsEnum.READ])
    async getUsers(@Req() req, @Res() res, @Query() filters: BaseFilterQuery) {
        // <-- Lack of documentation due to inconsistent stuff
        // filters variable is just for documentation purposes. But a refactoring removing Req and Res would be great.
        const query = QueryParser.toQueryObject(req.url)
        if (!query.sort) query.sort = { _created_at: -1 }
        if (!query.filter) query.filter = {} // ??? not documented
        if (!query.projection) query.projection = {} // ??? not documented
        query.projection.accessToken = 0

        const users = await this.usersService.getUsers(query)
        users.forEach((x) => this.assignReferences(x))

        return res.status(200).send(users)
    }

    @Get('/:userName')
    @ApiOperation({
        summary: `Get an user`,
        description: `Allows fetching content of a specific user passing its name`,
    })
    @ApiParam({
        name: 'userName',
        required: true,
        description: `Name of the user to fetch`,
        schema: { type: 'string' },
    })
    @ApiResponse({ status: 200, description: `User matching name`, type: User })
    @Permission([UserPermissionsEnum.READ])
    async getUser(@Param('userName') userName: string) {
        const user = await this.usersService.getUser({
            filter: { nickname: userName },
            projection: { accessToken: 0 },
        })

        this.assignReferences(user)

        return user
    }

    @Post('/')
    @ApiOperation({
        summary: `Creates an user`,
        description: `If requester has UserPermissionsEnum.CREATE permission, creates an user`,
    })
    @ApiResponse({ status: 201, description: `User creation gone well`, type: User })
    @Permission([UserPermissionsEnum.CREATE])
    async createUser(@Body() user: CreateUserRequest) {
        return this.usersService.createUser(user)
    }
}
