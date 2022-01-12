import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { GenericController } from '../../generic/controller.generic'
import { QueryParser } from '../../helpers/queryParser'
import { BaseFilterQuery } from '../../model/dto/base-filter.dto'
import { CreateUserRequest } from '../../model/dto/create-user-request.dto'
import { NormalizedResponse } from '../../model/dto/normalized-reponse.dto'
import { UpdateUserRequest } from '../../model/dto/update-user-request.dto'
import { UserAccount } from '../../model/user-account'
import { User } from '../../model/user.model'
import { Permission } from '../auth/annotations/permission.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { UserPermissionsEnum } from './security/user-permissions.enum'
import { UsersService } from './users.service'

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

    @Patch('/:email')
    @ApiOperation({
        summary: `Update an user`,
        description: `Allows updating an user passing its name`,
    })
    @ApiParam({
        name: 'email',
        required: true,
        description: `Email of the user to update`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Authenticated user data`,
        type: User,
    })
    public async updateUserData(@Param('email') email: string, @Body() data: UpdateUserRequest): Promise<NormalizedResponse> {
        const user: User = await this.usersService.updateUserData(email, data)
        return new NormalizedResponse(user)
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
    @ApiResponse({ status: 200, description: `Deletion done successfully` })
    @Permission([UserPermissionsEnum.DELETE])
    async deleteUser(@Param('mail') mail: string) {
        await this.usersService.deleteUser(mail)
    }

    @Patch('/:email/accounts')
    @ApiOperation({
        summary: `Add an account to an user`,
        description: `Allows adding an account to an user passing its username`,
    })
    @ApiParam({
        name: 'email',
        required: true,
        description: `Email of the user to add an account`,
        schema: { type: 'string' },
    })
    @ApiResponse({ status: 200, description: `Account added successfully` })
    @Permission([UserPermissionsEnum.EDIT])
    async addAccount(@Param('email') email: string, @Body() userAccount: UserAccount): Promise<boolean> {
        return this.usersService.addAccount(email, userAccount)
    }

    @Delete('/:email/accounts/:provider/:accountId')
    @ApiOperation({
        summary: `Remove an account from an user`,
        description: `Allows removing an account from an user passing its username`,
    })
    @ApiParam({
        name: 'email',
        required: true,
        description: `Email of the user to remove an account`,
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'provider',
        required: true,
        description: `Provider of the account to remove`,
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'accountId',
        required: true,
        description: `Id of the account to remove`,
        schema: { type: 'string' },
    })
    @ApiResponse({ status: 200, description: `Account removed successfully` })
    @Permission([UserPermissionsEnum.EDIT])
    async removeAccount(@Param('email') email: string, @Param('provider') provider: string, @Param('accountId') accountId: string) {
        return this.usersService.removeAccount(email, provider, accountId)
    }
}
