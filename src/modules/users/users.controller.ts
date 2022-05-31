import {
    AddUserAccountDTO,
    CreateKysoAccessTokenDto,
    CreateUserRequestDTO,
    EmailUserChangePasswordDTO,
    HEADER_X_KYSO_ORGANIZATION,
    HEADER_X_KYSO_TEAM,
    KysoPermissions,
    KysoUserAccessToken,
    NormalizedResponseDTO,
    Token,
    UpdateUserRequestDTO,
    User,
    UserChangePasswordDTO,
    UserDTO,
    UserPermissionsEnum,
    VerifyCaptchaRequestDto,
} from '@kyso-io/kyso-model'
import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    NotFoundException,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Autowired } from '../../decorators/autowired'
import { Public } from '../../decorators/is-public'
import { GenericController } from '../../generic/controller.generic'
import { QueryParser } from '../../helpers/queryParser'
import { CurrentToken } from '../auth/annotations/current-token.decorator'
import { Permission } from '../auth/annotations/permission.decorator'
import { AuthService } from '../auth/auth.service'
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { SolvedCaptchaGuard } from '../auth/guards/solved-captcha.guard'
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
    @Autowired({ typeName: 'AuthService' })
    private authService: AuthService

    constructor(private readonly usersService: UsersService) {
        super()
    }

    assignReferences(user: User) {
        // user.self_url = HateoasLinker.createRef(`/users/${user.display_name}`)
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
    async getUsers(@Query('user_id') userId: string[], @Req() req): Promise<NormalizedResponseDTO<UserDTO[]>> {
        const query = QueryParser.toQueryObject(req.url)
        if (userId && userId.length > 0) {
            const mapped = userId.map((x) => {
                const result = { id: x }
                return result
            })
            query.filter = { $or: mapped }
        }
        const result: User[] = await this.usersService.getUsers(query)
        return new NormalizedResponseDTO(UserDTO.fromUserArray(result))
    }

    @Get('/access-tokens')
    @ApiOperation({
        summary: `Get access tokens`,
        description: `Allows fetching access tokens of an user`,
    })
    @ApiResponse({ status: 200, description: `Access tokens`, type: KysoUserAccessToken, isArray: true })
    // @Permission([UserPermissionsEnum.READ])
    async getAccessTokens(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<KysoUserAccessToken[]>> {
        const tokens: KysoUserAccessToken[] = await this.usersService.getAccessTokens(token.id)
        return new NormalizedResponseDTO(tokens)
    }

    @Post('/access-token')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Creates an access token for the specified user`,
        description: `Creates an access token for the specified user`,
    })
    @ApiResponse({ status: 200, description: `Access Token created successfully`, type: KysoUserAccessToken })
    // @Permission([UserPermissionsEnum.EDIT])
    async createUserAccessToken(
        @CurrentToken() token: Token,
        @Body() accessTokenConfiguration: CreateKysoAccessTokenDto,
    ): Promise<NormalizedResponseDTO<KysoUserAccessToken>> {
        // TODO: get the right permissions for the user
        const permissions: KysoPermissions[] = []
        const response: KysoUserAccessToken = await this.usersService.createKysoAccessToken(
            token.id,
            accessTokenConfiguration.name,
            permissions,
            accessTokenConfiguration.expiration_date,
        )
        return new NormalizedResponseDTO(response)
    }

    @Patch('/access-token/revoke-all')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Revoke all user access tokens`,
        description: `Revoke all user access tokens`,
    })
    @ApiResponse({ status: 200, description: `Access Tokens deleted successfully`, type: KysoUserAccessToken, isArray: true })
    // @Permission([UserPermissionsEnum.EDIT])
    async revokeAllUserAccessToken(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<KysoUserAccessToken[]>> {
        const result: KysoUserAccessToken[] = await this.usersService.revokeAllUserAccessToken(token.id)
        return new NormalizedResponseDTO(result)
    }

    @Delete('/access-token/:accessTokenId')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Deletes an access token`,
        description: `Deletes an access token`,
    })
    @ApiParam({
        name: 'accessTokenId',
        required: true,
        description: `id of the access token to delete`,
        schema: { type: 'string' },
    })
    @ApiResponse({ status: 200, description: `Access Token deleted successfully`, type: KysoUserAccessToken })
    // @Permission([UserPermissionsEnum.EDIT])
    async deleteUserAccessToken(
        @CurrentToken() token: Token,
        @Param('accessTokenId') accessTokenId: string,
    ): Promise<NormalizedResponseDTO<KysoUserAccessToken[]>> {
        const result: KysoUserAccessToken = await this.usersService.deleteKysoAccessToken(token.id, accessTokenId)
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
    async getUserById(@Param('userId') userId: string): Promise<NormalizedResponseDTO<UserDTO>> {
        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new NotFoundException(`User with id ${userId} not found`)
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

    @Get('/:userId/portrait')
    @Public()
    @ApiOperation({
        summary: `Get user's portrait`,
        description: `Allows fetching portrait of an user passing his id`,
    })
    @ApiParam({
        name: 'username',
        required: true,
        description: `Username of the user to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `User matching name`, type: User })
    async getUserPortrait(@Param('userId') userId: string): Promise<string> {
        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new BadRequestException(`User with id ${userId} not found`)
        }

        return user.avatar_url
    }

    @Get('/:userId/public-data')
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
    async getUserPublicData(@Param('userId') userId: string): Promise<NormalizedResponseDTO<UserDTO>> {
        const user: User = await this.usersService.getUserById(userId)
        if (!user) {
            throw new BadRequestException(`User with id ${userId} not found`)
        }

        const userDto: UserDTO = UserDTO.fromUser(user)
        return new NormalizedResponseDTO(userDto)
    }

    @Post()
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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

    @Post('/accounts')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
    // @Permission([UserPermissionsEnum.EDIT])
    async addAccount(@CurrentToken() token: Token, @Body() addUserAccountDTO: AddUserAccountDTO): Promise<boolean> {
        return this.authService.addUserAccount(token, addUserAccountDTO)
    }

    @Delete('/accounts/:provider/:accountId')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Remove an account from an user`,
        description: `Allows removing an account from an user passing its username`,
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
    async removeAccount(
        @CurrentToken() token: Token,
        @Param('provider') provider: string,
        @Param('accountId') accountId: string,
    ): Promise<NormalizedResponseDTO<boolean>> {
        const result: boolean = await this.usersService.removeAccount(token.id, provider, accountId)
        return new NormalizedResponseDTO(result)
    }

    @UseInterceptors(FileInterceptor('file'))
    @Post('/profile-picture')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Upload a profile picture for a team`,
        description: `Allows uploading a profile picture for a user the image`,
    })
    @ApiNormalizedResponse({ status: 201, description: `Updated user`, type: UserDTO })
    public async setProfilePicture(@CurrentToken() token: Token, @UploadedFile() file: any): Promise<NormalizedResponseDTO<UserDTO>> {
        if (!file) {
            throw new BadRequestException(`Missing file`)
        }
        if (file.mimetype.split('/')[0] !== 'image') {
            throw new BadRequestException(`Only image files are allowed`)
        }
        const user: User = await this.usersService.setProfilePicture(token, file)
        return new NormalizedResponseDTO(UserDTO.fromUser(user))
    }

    @Delete('/profile-picture')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Delete a profile picture for a team`,
        description: `Allows deleting a profile picture for a user`,
    })
    @ApiNormalizedResponse({ status: 200, description: `Updated user`, type: UserDTO })
    public async deleteBackgroundImage(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<UserDTO>> {
        const user: User = await this.usersService.deleteProfilePicture(token)
        return new NormalizedResponseDTO(UserDTO.fromUser(user))
    }

    @Post('verify-captcha')
    @ApiOperation({
        summary: `Verify captcha`,
        description: `Allows verifying captcha`,
    })
    @ApiNormalizedResponse({ status: 200, description: `Updated user`, type: Boolean })
    public async verifyCaptcha(@CurrentToken() token: Token, @Body() data: VerifyCaptchaRequestDto): Promise<NormalizedResponseDTO<boolean>> {
        const success: boolean = await this.usersService.verifyCaptcha(token.id, data)
        return new NormalizedResponseDTO(success)
    }

    @Post('email-recovery-password')
    @Public()
    @ApiNormalizedResponse({ status: 200, description: `Updated user`, type: Boolean })
    public async sendEmailRecoveryPassword(@Body() emailUserChangePasswordDTO: EmailUserChangePasswordDTO): Promise<NormalizedResponseDTO<boolean>> {
        const success: boolean = await this.usersService.sendEmailRecoveryPassword(emailUserChangePasswordDTO)
        return new NormalizedResponseDTO(success)
    }

    @Post('change-password')
    @Public()
    @ApiNormalizedResponse({ status: 200, description: `Updated user`, type: Boolean })
    public async changePassword(@Body() userChangePasswordDto: UserChangePasswordDTO): Promise<NormalizedResponseDTO<boolean>> {
        const success: boolean = await this.usersService.changePassword(userChangePasswordDto)
        return new NormalizedResponseDTO(success)
    }
}
