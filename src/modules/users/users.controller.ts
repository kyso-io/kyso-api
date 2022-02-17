import {
    CreateKysoAccessTokenDto,
    CreateUserRequestDTO,
    HEADER_X_KYSO_ORGANIZATION,
    HEADER_X_KYSO_TEAM,
    KysoUserAccessToken,
    NormalizedResponseDTO,
    Token,
    UpdateUserRequestDTO,
    User,
    UserAccount,
    UserDTO,
    UserPermissionsEnum,
} from '@kyso-io/kyso-model'
import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Public } from '../../decorators/is-public'
import { GenericController } from '../../generic/controller.generic'
import { CurrentToken } from '../auth/annotations/current-token.decorator'
import { Permission } from '../auth/annotations/permission.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { UsersService } from './users.service'

@ApiTags('users')
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('users')
@ApiHeader({
    name: HEADER_X_KYSO_ORGANIZATION,
    description: 'active organization (i.e: lightside)',
    required: true,
})
@ApiHeader({
    name: HEADER_X_KYSO_TEAM,
    description: 'active team (i.e: protected-team)',
    required: true,
})
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
    @ApiQuery({
        required: false,
        name: 'user_id',
        type: String,
        isArray: true,
        description: 'UserId to search for. Could be more than one user_id query strings and will search for everyone',
    })
    @ApiQuery({
        required: false,
        name: 'page',
        type: Number,
        isArray: false,
        description: 'Page to retrieve. Default value <b>1</b>',
    })
    @ApiQuery({
        required: false,
        name: 'per_page',
        type: Number,
        isArray: false,
        description: 'Number of elements per page. Default value <b>20</b>',
    })
    @ApiQuery({
        required: false,
        name: 'sort',
        type: String,
        example: 'asc | desc',
        isArray: false,
        description: 'Sort by creation_date. Values allowed: asc or desc. Default. <b>desc</b>',
    })
    @Permission([UserPermissionsEnum.READ])
    async getUsers(
        @Query('user_id') userId: string[],
        @Query('page') page: number,
        @Query('per_page') per_page: number,
        @Query('sort') sort: string,
    ): Promise<NormalizedResponseDTO<UserDTO[]>> {
        if (!page) {
            page = 1
        }

        if (!per_page) {
            per_page = 20
        }

        const query: any = {
            filter: {},
            sort: {
                created_at: -1,
            },
            limit: per_page,
            skip: (page - 1) * per_page,
        }
        if (userId) {
            const mapped = userId.map((x) => {
                console.log(x)
                const result = { id: x }

                return result
            })

            query.filter = { $or: mapped }
        }
        if (sort && (sort === 'asc' || sort === 'desc')) {
            query.sort.created_at = sort === 'asc' ? 1 : -1
        }

        const result: User[] = await this.usersService.getUsers(query)

        return new NormalizedResponseDTO(UserDTO.fromUserArray(result))
    }

    @Get('/:userId')
    @ApiOperation({
        summary: `Get an user`,
        description: `Allows fetching content of a specific user passing its id`,
    })
    @ApiParam({
        name: 'userId',
        required: true,
        description: `Id of the user to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `User matching name`, type: User })
    @Permission([UserPermissionsEnum.READ])
    async getUserById(@Param('userId') userId: string): Promise<NormalizedResponseDTO<UserDTO>> {
        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new BadRequestException(`User with id ${userId} not found`)
        }
        return new NormalizedResponseDTO(UserDTO.fromUser(user))
    }

    @Get('/:username/profile')
    @Public()
    @ApiOperation({
        summary: `Get user profile`,
        description: `Allows fetching content of a specific user passing its id`,
    })
    @ApiParam({
        name: 'username',
        required: true,
        description: `Username of the user to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `User matching name`, type: User })
    async getUserProfile(@Param('username') username: string): Promise<NormalizedResponseDTO<UserDTO>> {
        const user: User = await this.usersService.getUser({ filter: { username } })
        if (!user) {
            throw new BadRequestException(`User with username ${username} not found`)
        }
        const userDto: UserDTO = UserDTO.fromUser(user)
        return new NormalizedResponseDTO(userDto)
    }

    @Post()
    @ApiOperation({
        summary: `Creates an user`,
        description: `If requester has UserPermissionsEnum.CREATE permission, creates an user`,
    })
    @ApiNormalizedResponse({ status: 201, description: `User creation gone well`, type: User })
    @Permission([UserPermissionsEnum.CREATE])
    async createUser(@Body() user: CreateUserRequestDTO): Promise<NormalizedResponseDTO<UserDTO>> {
        return new NormalizedResponseDTO(UserDTO.fromUser(await this.usersService.createUser(user)))
    }

    @Patch('/:userId')
    @ApiOperation({
        summary: `Update an user`,
        description: `Allows updating an user passing its id`,
    })
    @ApiParam({
        name: 'userId',
        required: true,
        description: `Id of the user to update`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Authenticated user data`,
        type: User,
    })
    public async updateUserData(@Param('userId') userId: string, @Body() data: UpdateUserRequestDTO): Promise<NormalizedResponseDTO<UserDTO>> {
        const user: User = await this.usersService.updateUserData(userId, data)
        return new NormalizedResponseDTO(UserDTO.fromUser(user))
    }

    @Delete('/:id')
    @ApiOperation({
        summary: `Delete a user`,
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
    async deleteUser(@Param('userId') userId: string): Promise<NormalizedResponseDTO<boolean>> {
        const deleted: boolean = await this.usersService.deleteUser(userId)
        return new NormalizedResponseDTO(deleted)
    }

    @Patch('/:userId/accounts')
    @ApiOperation({
        summary: `Add an account to an user`,
        description: `Allows adding an account to an user passing its id`,
    })
    @ApiParam({
        name: 'userId',
        required: true,
        description: `id of the user to add an account`,
        schema: { type: 'string' },
    })
    @ApiResponse({ status: 200, description: `Account added successfully` })
    @Permission([UserPermissionsEnum.EDIT])
    async addAccount(@Param('userId') userId: string, @Body() userAccount: UserAccount): Promise<boolean> {
        return this.usersService.addAccount(userId, userAccount)
    }

    @Post('/:userId/access_token')
    @ApiOperation({
        summary: `Creates an access token for the specified user`,
        description: `Creates an access token for the specified user`,
    })
    @ApiParam({
        name: 'userId',
        required: true,
        description: `id of the user to create an access token`,
        schema: { type: 'string' },
    })
    @ApiResponse({ status: 200, description: `Access Token created successfully`, type: KysoUserAccessToken })
    @Permission([UserPermissionsEnum.EDIT])
    async createUserAccessToken(@Param('userId') userId: string, @Body() accessTokenConfiguration: CreateKysoAccessTokenDto): Promise<KysoUserAccessToken> {
        return this.usersService.createKysoAccessToken(
            accessTokenConfiguration.user_id,
            accessTokenConfiguration.name,
            accessTokenConfiguration.scope,
            accessTokenConfiguration.expiration_date,
        )
    }

    @Delete('/:userId/accounts/:provider/:accountId')
    @ApiOperation({
        summary: `Remove an account from an user`,
        description: `Allows removing an account from an user passing its username`,
    })
    @ApiParam({
        name: 'userId',
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
    @ApiResponse({ status: 200, description: `Account removed successfully`, type: Boolean })
    @Permission([UserPermissionsEnum.EDIT])
    async removeAccount(@Param('userId') userId: string, @Param('provider') provider: string, @Param('accountId') accountId: string): Promise<boolean> {
        return this.usersService.removeAccount(userId, provider, accountId)
    }

    @UseInterceptors(
        FileInterceptor('file', {
            fileFilter: (req, file, callback) => {
                if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
                    return callback(new Error('Only image files are allowed!'), false)
                }
                callback(null, true)
            },
        }),
    )
    @Post('/profile-picture')
    @ApiOperation({
        summary: `Upload a profile picture for a team`,
        description: `Allows uploading a profile picture for a user the image`,
    })
    @ApiNormalizedResponse({ status: 201, description: `Updated user`, type: UserDTO })
    public async setProfilePicture(@CurrentToken() token: Token, @UploadedFile() file: any): Promise<NormalizedResponseDTO<UserDTO>> {
        if (!file) {
            throw new BadRequestException(`Missing file`)
        }
        const user: User = await this.usersService.setProfilePicture(token, file)
        return new NormalizedResponseDTO(UserDTO.fromUser(user))
    }

    @Delete('/profile-picture')
    @ApiOperation({
        summary: `Delete a profile picture for a team`,
        description: `Allows deleting a profile picture for a user`,
    })
    @ApiNormalizedResponse({ status: 200, description: `Updated user`, type: UserDTO })
    public async deleteBackgroundImage(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<UserDTO>> {
        const user: User = await this.usersService.deleteProfilePicture(token)
        return new NormalizedResponseDTO(UserDTO.fromUser(user))
    }
}
