import { BaseFilterQuery, CreateUserRequest, NormalizedResponse, Token, UpdateUserRequest, User, UserAccount } from '@kyso-io/kyso-model'
import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { diskStorage } from 'multer'
import { extname } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { GenericController } from '../../generic/controller.generic'
import { QueryParser } from '../../helpers/queryParser'
import { CurrentToken } from '../auth/annotations/current-token.decorator'
import { Permission } from '../auth/annotations/permission.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { UserPermissionsEnum } from './security/user-permissions.enum'
import { UsersService } from './users.service'

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

    @Get()
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
    async getUsers(@Req() req, @Query() filters: BaseFilterQuery): Promise<NormalizedResponse<User[]>> {
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

        const result: User[] = await this.usersService.getUsers(query)
        return new NormalizedResponse(result)
    }

    @Get(':id')
    @ApiOperation({
        summary: `Get an user`,
        description: `Allows fetching content of a specific user passing its id`,
    })
    @ApiParam({
        name: 'id',
        required: true,
        description: `Id of the user to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `User matching name`, type: User })
    @Permission([UserPermissionsEnum.READ])
    async getUserById(@Param('id') id: string): Promise<NormalizedResponse<User>> {
        const user: User = await this.usersService.getUserById(id)
        if (!user) {
            throw new BadRequestException(`User with id ${id} not found`)
        }
        this.assignReferences(user)
        return new NormalizedResponse(user)
    }

    @Post()
    @ApiOperation({
        summary: `Creates an user`,
        description: `If requester has UserPermissionsEnum.CREATE permission, creates an user`,
    })
    @ApiNormalizedResponse({ status: 201, description: `User creation gone well`, type: User })
    @Permission([UserPermissionsEnum.CREATE])
    async createUser(@Body() user: CreateUserRequest): Promise<NormalizedResponse<User>> {
        return new NormalizedResponse(await this.usersService.createUser(user))
    }

    @Patch(':id')
    @ApiOperation({
        summary: `Update an user`,
        description: `Allows updating an user passing its id`,
    })
    @ApiParam({
        name: 'id',
        required: true,
        description: `Id of the user to update`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Authenticated user data`,
        type: User,
    })
    public async updateUserData(@Param('id') id: string, @Body() data: UpdateUserRequest): Promise<NormalizedResponse<User>> {
        const user: User = await this.usersService.updateUserData(id, data)
        return new NormalizedResponse(user)
    }

    @Delete(':id')
    @ApiOperation({
        summary: `Deletes an user`,
        description: `Allows deleting a specific user passing its id`,
    })
    @ApiParam({
        name: 'id',
        required: true,
        description: `Id of the user to delete`,
        schema: { type: 'string' },
    })
    @ApiResponse({ status: 200, description: `Deletion done successfully` })
    @ApiNormalizedResponse({ status: 200, description: `Organization matching name`, type: Boolean })
    @Permission([UserPermissionsEnum.DELETE])
    async deleteUser(@Param('id') id: string): Promise<NormalizedResponse<boolean>> {
        const deleted: boolean = await this.usersService.deleteUser(id)
        return new NormalizedResponse(deleted)
    }

    @Patch(':id/accounts')
    @ApiOperation({
        summary: `Add an account to an user`,
        description: `Allows adding an account to an user passing its id`,
    })
    @ApiParam({
        name: 'id',
        required: true,
        description: `id of the user to add an account`,
        schema: { type: 'string' },
    })
    @ApiResponse({ status: 200, description: `Account added successfully` })
    @Permission([UserPermissionsEnum.EDIT])
    async addAccount(@Param('id') id: string, @Body() userAccount: UserAccount): Promise<boolean> {
        return this.usersService.addAccount(id, userAccount)
    }

    @Delete('/:id/accounts/:provider/:accountId')
    @ApiOperation({
        summary: `Remove an account from an user`,
        description: `Allows removing an account from an user passing its username`,
    })
    @ApiParam({
        name: 'id',
        required: true,
        description: `Id of the user to remove an account`,
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
    async removeAccount(@Param('id') id: string, @Param('provider') provider: string, @Param('accountId') accountId: string) {
        return this.usersService.removeAccount(id, provider, accountId)
    }

    @UseInterceptors(
        FileInterceptor('profilePicture', {
            storage: diskStorage({
                destination: './public/users-profile-pictures',
                filename: (req, file, callback) => {
                    callback(null, `${uuidv4()}${extname(file.originalname)}`)
                },
            }),
            fileFilter: (req, file, callback) => {
                if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
                    return callback(new Error('Only image files are allowed!'), false)
                }
                callback(null, true)
            },
        }),
    )
    @Post('profile-picture')
    @ApiOperation({
        summary: `Upload a profile picture for a team`,
        description: `Allows uploading a profile picture for a user the image`,
    })
    @ApiNormalizedResponse({ status: 201, description: `Updated user`, type: User })
    // Commented type throwing an Namespace 'global.Express' has no exported member 'Multer' error
    public async setProfilePicture(@CurrentToken() token: Token, @UploadedFile() file: any /*Express.Multer.File*/): Promise<NormalizedResponse<User>> {
        if (!file) {
            throw new BadRequestException(`Missing file`)
        }
        const user: User = await this.usersService.setProfilePicture(token, file)
        return new NormalizedResponse(user)
    }

    @Delete('profile-picture')
    @ApiOperation({
        summary: `Delete a profile picture for a team`,
        description: `Allows deleting a profile picture for a user`,
    })
    @ApiNormalizedResponse({ status: 200, description: `Updated user`, type: User })
    public async deleteBackgroundImage(@CurrentToken() token: Token): Promise<NormalizedResponse<User>> {
        const user: User = await this.usersService.deleteProfilePicture(token)
        return new NormalizedResponse(user)
    }
}
