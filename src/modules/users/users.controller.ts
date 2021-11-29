import {
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    Res,
} from '@nestjs/common'
import {
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger'
import { UsersService } from './users.service'
import { GenericController } from 'src/generic/controller.generic'
import { HateoasLinker } from 'src/helpers/hateoasLinker'
import { QueryParser } from 'src/helpers/queryParser'
import { User } from 'src/model/user.model'
import { BaseFilterQuery } from 'src/model/dto/base-filter.dto'

const UPDATABLE_FIELDS = [
    'email',
    'nickname',
    'bio',
    'accessToken',
    'access_token',
]

@ApiTags('users')
@Controller('users')
export class UsersController extends GenericController<User> {
    constructor(private readonly usersService: UsersService) {
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
    async getUser(@Param('userName') userName: string) {
        const user = await this.usersService.getUser({
            filter: { nickname: userName },
            projection: { accessToken: 0 },
        })

        this.assignReferences(user)

        return user
    }
}
