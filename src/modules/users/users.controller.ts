import { Body,  Controller, Delete, Get, Param, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { UsersService } from './users.service'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { UserPermissionsEnum } from './security/user-permissions.enum'
import { Permission } from '../auth/annotations/permission.decorator'
import { User } from '../../model/user.model'
import { GenericController } from '../../generic/controller.generic'
import { QueryParser } from '../../helpers/queryParser'
import { BaseFilterQuery } from '../../model/dto/base-filter.dto'
import { CreateUserRequest } from '../../model/dto/create-user-request.dto'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-repose'
import { NormalizedResponse } from '../../model/dto/normalized-reponse.dto'

const UPDATABLE_FIELDS = ['email', 'nickname', 'bio', 'accessToken', 'access_token']

@ApiTags('users')
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('users')
export class UsersController extends GenericController<User> {
    constructor(private readonly usersService: UsersService) {
        super()
    }

    assignReferences(user: User) {
        // user.self_url = HateoasLinker.createRef(`/users/${user.nickname}`)
    }

    @Get('/')
    @ApiOperation({
        summary: `Search and fetch users`,
        description: `By passing the appropiate parameters you can fetch and filter the users of the platform.
            **This endpoint supports filtering**. Refer to the User schema to see available options.`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Users matching criteria`,
        type: User,
    })
    @Permission([UserPermissionsEnum.READ])
    async getUsers(@Req() req, @Query() filters: BaseFilterQuery): Promise<NormalizedResponse> {
        // <-- Lack of documentation due to inconsistent stuff
        // filters variable is just for documentation purposes. But a refactoring removing Req and Res would be great.
        const query = QueryParser.toQueryObject(req.url)
        if (!query.sort) {
            query.sort = { _created_at: -1 }
        }
        if (!query.filter) {
            query.filter = {} // ??? not documented
        }

        if (!query.projection) {
            query.projection = {} // ??? not documented
        }

        query.projection.accessToken = 0

        const result: User[] = await this.usersService.getUsers(query)
        return new NormalizedResponse(result)
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
    @ApiNormalizedResponse({ status: 200, description: `User matching name`, type: User })
    @Permission([UserPermissionsEnum.READ])
    async getUser(@Param('userName') userName: string): Promise<NormalizedResponse> {
        const user: User = await this.usersService.getUser({
            filter: { nickname: userName },
            projection: { accessToken: 0 },
        })

        this.assignReferences(user)

        return new NormalizedResponse(user)
    }

    @Post('/')
    @ApiOperation({
        summary: `Creates an user`,
        description: `If requester has UserPermissionsEnum.CREATE permission, creates an user`,
    })
    @ApiNormalizedResponse({ status: 201, description: `User creation gone well`, type: User })
    @Permission([UserPermissionsEnum.CREATE])
    async createUser(@Body() user: CreateUserRequest) {
        return new NormalizedResponse(await this.usersService.createUser(user))
    }

    @Delete('/:mail')
    @ApiOperation({
        summary: `Deletes an user`,
        description: `Allows deleting a specific user passing its email`,
    })
    @ApiParam({
        name: 'mail',
        required: true,
        description: `Name of the user to delete`,
        schema: { type: 'string' },
    })
    @ApiResponse({ status: 200, description: `Deletion done successfully`})
    @Permission([UserPermissionsEnum.DELETE])
    async deleteUser(@Param('mail') mail: string) {
        await this.usersService.deleteUser(mail)
    }
}
