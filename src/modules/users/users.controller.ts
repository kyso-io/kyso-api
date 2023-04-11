import {
  AddUserAccountDTO,
  CreateKysoAccessTokenDto,
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
} from '@kyso-io/kyso-model';
import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Headers, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FormDataRequest } from 'nestjs-form-data';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
import { Autowired } from '../../decorators/autowired';
import { Public } from '../../decorators/is-public';
import { UploadImageDto } from '../../dtos/upload-image.dto';
import { GenericController } from '../../generic/controller.generic';
import { QueryParser } from '../../helpers/queryParser';
import { Validators } from '../../helpers/validators';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { Permission } from '../auth/annotations/permission.decorator';
import { AuthService } from '../auth/auth.service';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { SolvedCaptchaGuard } from '../auth/guards/solved-captcha.guard';
import { UsersService } from './users.service';

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
  private authService: AuthService;

  constructor(private readonly usersService: UsersService) {
    super();
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
  @Public()
  async getUsers(@Query('user_id') userId: string[], @Req() req): Promise<NormalizedResponseDTO<UserDTO[]>> {
    const query = QueryParser.toQueryObject(req.url);
    if (userId && userId.length > 0) {
      const mapped = userId.map((x) => {
        const result = { id: x };
        return result;
      });
      query.filter = { $or: mapped };
    }

    if (query?.filter?.$text) {
      if (!query.filter.hasOwnProperty('$or')) {
        query.filter.$or = [];
      }
      query.filter.$or.push({ email: query.filter.$text.$search });
      query.filter.$or.push({ email: { $regex: query.filter.$text.$search, $options: 'i' } });
      query.filter.$or.push({ username: { $regex: query.filter.$text.$search, $options: 'i' } });
      query.filter.$or.push({ display_name: { $regex: query.filter.$text.$search, $options: 'i' } });
      delete query.filter.$text;
    }

    const result: User[] = await this.usersService.getUsers(query);
    return new NormalizedResponseDTO(UserDTO.fromUserArray(result));
  }

  @Get('/access-tokens')
  @ApiOperation({
    summary: `Get access tokens`,
    description: `Allows fetching access tokens of an user`,
  })
  @ApiResponse({ status: 200, description: `Access tokens`, type: KysoUserAccessToken, isArray: true })
  @Public()
  async getAccessTokens(@Headers('authorization') jwtToken: string, @CurrentToken() token: Token): Promise<NormalizedResponseDTO<KysoUserAccessToken[]>> {
    if (jwtToken && this.authService.evaluateAndDecodeToken(jwtToken.replace('Bearer ', ''))) {
      const tokens: KysoUserAccessToken[] = await this.usersService.getAccessTokens(token.id);
      return new NormalizedResponseDTO(tokens);
    } else {
      throw new ForbiddenException("Your token can't be validated");
    }
  }

  @Post('/access-token')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Creates an access token for the specified user`,
    description: `Creates an access token for the specified user`,
  })
  @ApiResponse({ status: 200, description: `Access Token created successfully`, type: KysoUserAccessToken })
  @Public()
  async createUserAccessToken(
    @Headers('authorization') jwtToken: string,
    @CurrentToken() token: Token,
    @Body() accessTokenConfiguration: CreateKysoAccessTokenDto,
  ): Promise<NormalizedResponseDTO<KysoUserAccessToken>> {
    if (jwtToken && this.authService.evaluateAndDecodeToken(jwtToken.replace('Bearer ', ''))) {
      // TODO: Now the token has the same permissions that the user, but in the future we can create
      // tokens with a specific scope
      const scope: KysoPermissions[] = [];

      const response: KysoUserAccessToken = await this.usersService.createKysoAccessToken(token.id, accessTokenConfiguration.name, scope, accessTokenConfiguration.expiration_date);
      return new NormalizedResponseDTO(response);
    } else {
      throw new ForbiddenException("Your token can't be validated");
    }
  }

  @Patch('/access-token/revoke-all')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Revoke all user access tokens`,
    description: `Revoke all user access tokens`,
  })
  @ApiResponse({ status: 200, description: `Access Tokens deleted successfully`, type: KysoUserAccessToken, isArray: true })
  @Public()
  async revokeAllUserAccessToken(@Headers('authorization') jwtToken: string, @CurrentToken() token: Token): Promise<NormalizedResponseDTO<KysoUserAccessToken[]>> {
    if (jwtToken && this.authService.evaluateAndDecodeToken(jwtToken.replace('Bearer ', ''))) {
      const result: KysoUserAccessToken[] = await this.usersService.revokeAllUserAccessToken(token.id);
      return new NormalizedResponseDTO(result);
    } else {
      throw new ForbiddenException("Your token can't be validated");
    }
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
  @Public()
  async deleteUserAccessToken(
    @Headers('authorization') jwtToken: string,
    @CurrentToken() token: Token,
    @Param('accessTokenId') accessTokenId: string,
  ): Promise<NormalizedResponseDTO<KysoUserAccessToken>> {
    if (!Validators.isValidObjectId(accessTokenId)) {
      throw new BadRequestException(`Invalid access token id ${accessTokenId}`);
    }

    if (this.authService.evaluateAndDecodeToken(jwtToken.replace('Bearer ', ''))) {
      const result: KysoUserAccessToken = await this.usersService.deleteKysoAccessToken(token.id, accessTokenId);
      return new NormalizedResponseDTO(result);
    } else {
      throw new ForbiddenException("Your token can't be validated");
    }
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
  @Public()
  async getUserById(@Headers('authorization') jwtToken: string, @Param('userId') userId: string): Promise<NormalizedResponseDTO<UserDTO>> {
    if (!Validators.isValidObjectId(userId)) {
      throw new BadRequestException(`Invalid user id ${userId}`);
    }

    if (this.authService.evaluateAndDecodeToken(jwtToken.replace('Bearer ', ''))) {
      const user: User = await this.usersService.getUserById(userId);
      if (!user) {
        throw new NotFoundException(`User with id ${userId} not found`);
      }
      return new NormalizedResponseDTO(UserDTO.fromUser(user));
    } else {
      throw new ForbiddenException("Your token can't be validated");
    }
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
    const user: User = await this.usersService.getUser({ filter: { username } });
    if (!user) {
      throw new NotFoundException(`User with username ${username} not found`);
    }
    const userDto: UserDTO = UserDTO.fromUser(user);
    delete userDto.accounts;
    delete userDto.email_verified;
    delete userDto.show_captcha;
    return new NormalizedResponseDTO(userDto);
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
    if (!Validators.isValidObjectId(userId)) {
      throw new BadRequestException(`Invalid user id ${userId}`);
    }
    const user: User = await this.usersService.getUserById(userId);
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
    return user.avatar_url;
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
    if (!Validators.isValidObjectId(userId)) {
      throw new BadRequestException(`Invalid user id ${userId}`);
    }
    const user: User = await this.usersService.getUserById(userId);
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
    const userDto: UserDTO = UserDTO.fromUser(user);
    delete userDto.accounts;
    delete userDto.email_verified;
    delete userDto.show_captcha;
    return new NormalizedResponseDTO(userDto);
  }

  @Patch('/:userId')
  @UseGuards()
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
  public async updateUserData(@CurrentToken() token: Token, @Param('userId') userId: string, @Body() data: UpdateUserRequestDTO): Promise<NormalizedResponseDTO<UserDTO>> {
    if (!Validators.isValidObjectId(userId)) {
      throw new BadRequestException(`Invalid user id ${userId}`);
    }
    if (token.id !== userId && !token.isGlobalAdmin()) {
      throw new ForbiddenException(`You are not allowed to update this user`);
    }
    const user: User = await this.usersService.updateUserData(token, userId, data);
    return new NormalizedResponseDTO(UserDTO.fromUser(user));
  }

  @Delete('/profile-picture')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Delete a profile picture for a team`,
    description: `Allows deleting a profile picture for a user`,
  })
  @ApiNormalizedResponse({ status: 200, description: `Updated user`, type: UserDTO })
  public async deleteBackgroundImage(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<UserDTO>> {
    const user: User = await this.usersService.deleteProfilePicture(token);
    return new NormalizedResponseDTO(UserDTO.fromUser(user));
  }

  @Delete('/:userId')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Delete a user`,
    description: `Allows deleting a specific user passing its id`,
  })
  @ApiParam({
    name: 'userId',
    required: true,
    description: `Id of the user to delete`,
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: `Deletion done successfully` })
  @ApiNormalizedResponse({ status: 200, description: `Organization matching name`, type: Boolean })
  @Permission([UserPermissionsEnum.DELETE])
  async deleteUser(@CurrentToken() token: Token, @Param('userId') userId: string): Promise<NormalizedResponseDTO<boolean>> {
    if (!Validators.isValidObjectId(userId)) {
      throw new BadRequestException(`Invalid user id ${userId}`);
    }
    const deleted: boolean = await this.usersService.deleteUser(token, userId);
    return new NormalizedResponseDTO(deleted);
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
    return this.authService.addUserAccount(token, addUserAccountDTO);
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
  // @Permission([UserPermissionsEnum.EDIT])
  async removeAccount(@CurrentToken() token: Token, @Param('provider') provider: string, @Param('accountId') accountId: string): Promise<NormalizedResponseDTO<boolean>> {
    const result: boolean = await this.usersService.removeAccount(token.id, provider, accountId);
    return new NormalizedResponseDTO(result);
  }

  @Post('/profile-picture')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Upload a profile picture for a team`,
    description: `Allows uploading a profile picture for a user the image`,
  })
  @ApiNormalizedResponse({ status: 201, description: `Updated user`, type: UserDTO })
  @FormDataRequest()
  public async setProfilePicture(@CurrentToken() token: Token, @Body() uploadImageDto: UploadImageDto): Promise<NormalizedResponseDTO<UserDTO>> {
    if (!uploadImageDto.file) {
      throw new BadRequestException(`Missing file`);
    }
    if (uploadImageDto.file.mimetype.split('/')[0] !== 'image') {
      throw new BadRequestException(`Only image files are allowed`);
    }
    if (token.id !== uploadImageDto.userId && !token.isGlobalAdmin()) {
      throw new ForbiddenException(`You are not allowed to update the photo of this user`);
    }
    const user: User = await this.usersService.setProfilePicture(uploadImageDto);
    return new NormalizedResponseDTO(UserDTO.fromUser(user));
  }

  @Post('/background-image')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Upload a profile picture for a team`,
    description: `Allows uploading a profile picture for a user the image`,
  })
  @ApiNormalizedResponse({ status: 201, description: `Updated user`, type: UserDTO })
  @FormDataRequest()
  public async setBackgroundImage(@CurrentToken() token: Token, @Body() uploadImageDto: UploadImageDto): Promise<NormalizedResponseDTO<UserDTO>> {
    if (!uploadImageDto.file) {
      throw new BadRequestException(`Missing file`);
    }
    if (uploadImageDto.file.mimetype.split('/')[0] !== 'image') {
      throw new BadRequestException(`Only image files are allowed`);
    }
    if (token.id !== uploadImageDto.userId && !token.isGlobalAdmin()) {
      throw new ForbiddenException(`You are not allowed to update the photo of this user`);
    }
    const user: User = await this.usersService.setBackgroundImage(uploadImageDto);
    return new NormalizedResponseDTO(UserDTO.fromUser(user));
  }

  @Post('verify-captcha')
  @ApiOperation({
    summary: `Verify captcha`,
    description: `Allows verifying captcha`,
  })
  @ApiNormalizedResponse({ status: 200, description: `Updated user`, type: Boolean })
  public async verifyCaptcha(@CurrentToken() token: Token, @Body() data: VerifyCaptchaRequestDto): Promise<NormalizedResponseDTO<boolean>> {
    const success: boolean = await this.usersService.verifyCaptcha(token.id, data);
    return new NormalizedResponseDTO(success);
  }

  @Post('email-recovery-password')
  @Public()
  @ApiNormalizedResponse({ status: 200, description: `Updated user`, type: Boolean })
  public async sendEmailRecoveryPassword(@Body() emailUserChangePasswordDTO: EmailUserChangePasswordDTO): Promise<NormalizedResponseDTO<boolean>> {
    const success: boolean = await this.usersService.sendEmailRecoveryPassword(emailUserChangePasswordDTO);
    return new NormalizedResponseDTO(success);
  }

  @Post('change-password')
  @Public()
  @ApiNormalizedResponse({ status: 200, description: `Updated user`, type: Boolean })
  public async changePassword(@Body() userChangePasswordDto: UserChangePasswordDTO): Promise<NormalizedResponseDTO<boolean>> {
    const success: boolean = await this.usersService.changePassword(userChangePasswordDto);
    return new NormalizedResponseDTO(success);
  }
}
