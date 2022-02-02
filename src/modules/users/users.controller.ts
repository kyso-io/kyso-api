import { BaseFilterQueryDTO, CreateUserRequestDTO, NormalizedResponseDTO, Token, UpdateUserRequestDTO, User, UserAccount } from '@kyso-io/kyso-model'
import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
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
    async getUsers(
        @Query('user_id') userId: string[],
        @Query('page', ParseIntPipe) page: number,
        @Query('per_page', ParseIntPipe) per_page: number,
        @Query('sort') sort: string): Promise<NormalizedResponseDTO<User[]>> {

        const query: any = {
            filter: {

            },
            sort: {
                created_at: -1,
            },
            limit: per_page,
            skip: (page - 1) * per_page,
        }
        if (userId) {
            const mapped = userId.map(x => {
                console.log(x)
                let result = { id: x }
    
                return result;
            })

            query.filter = { $or: mapped }
        } 
        if (sort && (sort === 'asc' || sort === 'desc')) {
            query.sort.created_at = sort === 'asc' ? 1 : -1
        }

        const result: User[] = await this.usersService.getUsers(query)
        return new NormalizedResponseDTO(result)
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
    async getUserById(@Param('userId') userId: string): Promise<NormalizedResponseDTO<User>> {
        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new BadRequestException(`User with id ${userId} not found`)
        }
        this.assignReferences(user)
        return new NormalizedResponseDTO(user)
    }

    @Post()
    @ApiOperation({
        summary: `Creates an user`,
        description: `If requester has UserPermissionsEnum.CREATE permission, creates an user`,
    })
    @ApiNormalizedResponse({ status: 201, description: `User creation gone well`, type: User })
    @Permission([UserPermissionsEnum.CREATE])
    async createUser(@Body() user: CreateUserRequestDTO): Promise<NormalizedResponseDTO<User>> {
        return new NormalizedResponseDTO(await this.usersService.createUser(user))
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
    public async updateUserData(@Param('userId') userId: string, @Body() data: UpdateUserRequestDTO): Promise<NormalizedResponseDTO<User>> {
        const user: User = await this.usersService.updateUserData(userId, data)
        return new NormalizedResponseDTO(user)
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
    @Post('/profile-picture')
    @ApiOperation({
        summary: `Upload a profile picture for a team`,
        description: `Allows uploading a profile picture for a user the image`,
    })
    @ApiNormalizedResponse({ status: 201, description: `Updated user`, type: User })
    // Commented type throwing an Namespace 'global.Express' has no exported member 'Multer' error
    public async setProfilePicture(@CurrentToken() token: Token, @UploadedFile() file: any /*Express.Multer.File*/): Promise<NormalizedResponseDTO<User>> {
        if (!file) {
            throw new BadRequestException(`Missing file`)
        }
        const user: User = await this.usersService.setProfilePicture(token, file)
        return new NormalizedResponseDTO(user)
    }

    @Delete('/profile-picture')
    @ApiOperation({
        summary: `Delete a profile picture for a team`,
        description: `Allows deleting a profile picture for a user`,
    })
    @ApiNormalizedResponse({ status: 200, description: `Updated user`, type: User })
    public async deleteBackgroundImage(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<User>> {
        const user: User = await this.usersService.deleteProfilePicture(token)
        return new NormalizedResponseDTO(user)
    }
}
