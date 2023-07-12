import {
  AddUserAccountDTO,
  CreateKysoAccessTokenDto,
  EmailInUseDTO,
  EmailUserChangePasswordDTO,
  HEADER_X_KYSO_ORGANIZATION,
  HEADER_X_KYSO_TEAM,
  KysoPermissions,
  KysoUserAccessToken,
  NormalizedResponseDTO,
  OnboardingProgress,
  OrganizationMember,
  Team,
  Token,
  UpdateUserRequestDTO,
  User,
  UserChangePasswordDTO,
  UserDTO,
  UserPermissionsEnum,
  VerifyCaptchaRequestDto,
} from '@kyso-io/kyso-model';
import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { FormDataRequest } from 'nestjs-form-data';
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
import { OrganizationsService } from '../organizations/organizations.service';
import { TeamsService } from '../teams/teams.service';
import { UsersService } from './users.service';

@ApiTags('users')
@UseGuards(PermissionsGuard)
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

  @Autowired({ typeName: 'OrganizationsService' })
  private organizationsService: OrganizationsService;

  @Autowired({ typeName: 'TeamsService' })
  private teamsService: TeamsService;

  constructor(private readonly usersService: UsersService) {
    super();
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: `Search and fetch users`,
    description: `By passing the appropiate parameters you can fetch and filter the users of the platform.
            **This endpoint supports filtering**. Refer to the User schema to see available options.`,
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
  @ApiResponse({
    status: 200,
    description: `Users matching criteria`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<User[]>([UserDTO.createEmpty()]),
          },
        },
      },
    },
  })
  async getUsers(@Req() req: Request): Promise<NormalizedResponseDTO<UserDTO[]>> {
    const query = QueryParser.toQueryObject(req.url);
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

  @Get('/same-organizations')
  @ApiBearerAuth()
  @ApiOperation({
    summary: `Get users who are in the same organizations`,
    description: `Get users who are in the same organizations`,
  })
  @ApiResponse({
    status: 200,
    description: `Users`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<User[]>([UserDTO.createEmpty()]),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
        },
      },
    },
  })
  public async getSameOrganizations(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<UserDTO[]>> {
    const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id);
    const organizationsSet: Set<string> = new Set(teams.map((team: Team) => team.organization_id));
    const result: OrganizationMember[][] = await Promise.all(Array.from(organizationsSet.values()).map((organizationId: string) => this.organizationsService.getOrganizationMembers(organizationId)));
    const map: Map<string, void> = new Map<string, void>();
    result.forEach((organizationMembers: OrganizationMember[]) => {
      organizationMembers.forEach((organizationMember: OrganizationMember) => {
        if (!map.has(organizationMember.id)) {
          map.set(organizationMember.id, void 0);
        }
      });
    });
    const users: User[] = await this.usersService.getUsers({ filter: { id: { $in: Array.from(map.keys()) } } });
    return new NormalizedResponseDTO(UserDTO.fromUserArray(users));
  }

  @Get('/access-tokens')
  @ApiBearerAuth()
  @ApiOperation({
    summary: `Get access tokens`,
    description: `Allows fetching access tokens of an user`,
  })
  @ApiResponse({
    status: 200,
    description: `Access tokens`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<KysoUserAccessToken[]>([KysoUserAccessToken.createEmpty()]),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
        },
      },
    },
  })
  async getAccessTokens(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<KysoUserAccessToken[]>> {
    const tokens: KysoUserAccessToken[] = await this.usersService.getAccessTokens(token.id);
    return new NormalizedResponseDTO(tokens);
  }

  @Post('/access-token')
  @Public()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Creates an access token for the specified user`,
    description: `Creates an access token for the specified user`,
  })
  @ApiResponse({
    status: 201,
    description: `New access tokens`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<KysoUserAccessToken>(KysoUserAccessToken.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
        },
      },
    },
  })
  async createUserAccessToken(@CurrentToken() token: Token, @Body() accessTokenConfiguration: CreateKysoAccessTokenDto): Promise<NormalizedResponseDTO<KysoUserAccessToken>> {
    const scope: KysoPermissions[] = [];
    const response: KysoUserAccessToken = await this.usersService.createKysoAccessToken(token.id, accessTokenConfiguration.name, scope, accessTokenConfiguration.expiration_date);
    return new NormalizedResponseDTO(response);
  }

  @Patch('/access-token/revoke-all')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Revoke all user access tokens`,
    description: `Revoke all user access tokens`,
  })
  @ApiResponse({
    status: 200,
    description: `Revoked access tokens`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<KysoUserAccessToken[]>([KysoUserAccessToken.createEmpty()]),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
        },
      },
    },
  })
  async revokeAllUserAccessToken(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<KysoUserAccessToken[]>> {
    const result: KysoUserAccessToken[] = await this.usersService.revokeAllUserAccessToken(token.id);
    return new NormalizedResponseDTO(result);
  }

  @Delete('/access-token/:accessTokenId')
  @ApiBearerAuth()
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
  @ApiResponse({
    status: 200,
    description: `Deleted access token`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<KysoUserAccessToken>(KysoUserAccessToken.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    content: {
      json: {
        examples: {
          invalidId: {
            value: new BadRequestException('Invalid id'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
          notBelong: {
            value: new ForbiddenException('The token does not belong to the user'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          accessTokenNotFound: {
            value: new NotFoundException('Access token not found'),
          },
        },
      },
    },
  })
  async deleteUserAccessToken(@CurrentToken() token: Token, @Param('accessTokenId') accessTokenId: string): Promise<NormalizedResponseDTO<KysoUserAccessToken>> {
    if (!Validators.isValidObjectId(accessTokenId)) {
      throw new BadRequestException(`Invalid id`);
    }
    const result: KysoUserAccessToken = await this.usersService.deleteKysoAccessToken(token.id, accessTokenId);
    return new NormalizedResponseDTO(result);
  }

  @Get('/:userId')
  @ApiBearerAuth()
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
  @ApiResponse({
    status: 200,
    description: `Requested user`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<UserDTO>(UserDTO.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          userNotFound: {
            value: new NotFoundException('User not found'),
          },
        },
      },
    },
  })
  async getUserById(@Param('userId') userId: string): Promise<NormalizedResponseDTO<UserDTO>> {
    if (!Validators.isValidObjectId(userId)) {
      throw new BadRequestException(`Invalid id`);
    }
    const user: User = await this.usersService.getUserById(userId);
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
    return new NormalizedResponseDTO(UserDTO.fromUser(user));
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
  @ApiResponse({
    status: 200,
    description: `Requested user`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<UserDTO>(UserDTO.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          userNotFound: {
            value: new NotFoundException('User not found'),
          },
        },
      },
    },
  })
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
  @ApiResponse({ status: 200, description: `User portrait`, type: String })
  @ApiResponse({
    status: 400,
    content: {
      json: {
        examples: {
          invalidId: {
            value: new BadRequestException('Invalid id'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          userNotFound: {
            value: new NotFoundException('User not found'),
          },
        },
      },
    },
  })
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
  @ApiResponse({
    status: 200,
    description: `Requested user`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<UserDTO>(UserDTO.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    content: {
      json: {
        examples: {
          invalidId: {
            value: new BadRequestException('Invalid id'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          userNotFound: {
            value: new NotFoundException('User not found'),
          },
        },
      },
    },
  })
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
  @ApiBearerAuth()
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
  @ApiBody({
    description: `User data to update`,
    type: UpdateUserRequestDTO,
    required: true,
    examples: {
      json: {
        value: new UpdateUserRequestDTO('Rey', 'Rey Skywalker', 'Galaxy', 'https://google.com', 'The best one', false, new OnboardingProgress(false, false, false, false, false, false)),
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: `Requested user`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<UserDTO>(UserDTO.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    content: {
      json: {
        examples: {
          invalidId: {
            value: new BadRequestException('Invalid id'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          notAllowed: {
            value: new ForbiddenException('You are not allowed to update this user'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          userNotFound: {
            value: new NotFoundException('User not found'),
          },
        },
      },
    },
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
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Delete a profile picture for a team`,
    description: `Allows deleting a profile picture for a user`,
  })
  @ApiResponse({
    status: 200,
    description: `Updated user`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<UserDTO>(UserDTO.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
        },
      },
    },
  })
  public async deleteBackgroundImage(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<UserDTO>> {
    const user: User = await this.usersService.deleteProfilePicture(token);
    return new NormalizedResponseDTO(UserDTO.fromUser(user));
  }

  @Delete('/:userId')
  @ApiBearerAuth()
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
  @ApiResponse({
    status: 200,
    description: `Deletion status`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<boolean>(true),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          userNotFound: {
            value: new NotFoundException('User not found'),
          },
        },
      },
    },
  })
  @Permission([UserPermissionsEnum.DELETE])
  async deleteUser(@CurrentToken() token: Token, @Param('userId') userId: string): Promise<NormalizedResponseDTO<boolean>> {
    if (!Validators.isValidObjectId(userId)) {
      throw new BadRequestException(`Invalid user id ${userId}`);
    }
    const deleted: boolean = await this.usersService.deleteUser(token, userId);
    return new NormalizedResponseDTO(deleted);
  }

  // Not used
  // @Post('/accounts')
  @ApiBearerAuth()
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
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
        },
      },
    },
  })
  async addAccount(@CurrentToken() token: Token, @Body() addUserAccountDTO: AddUserAccountDTO): Promise<boolean> {
    return this.authService.addUserAccount(token, addUserAccountDTO);
  }

  // Not used
  // @Delete('/accounts/:provider/:accountId')
  @ApiBearerAuth()
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
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
        },
      },
    },
  })
  async removeAccount(@CurrentToken() token: Token, @Param('provider') provider: string, @Param('accountId') accountId: string): Promise<NormalizedResponseDTO<boolean>> {
    const result: boolean = await this.usersService.removeAccount(token.id, provider, accountId);
    return new NormalizedResponseDTO(result);
  }

  @Post('/profile-picture')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Upload a profile picture for a team`,
    description: `Allows uploading a profile picture for a user the image`,
  })
  @ApiResponse({
    status: 201,
    description: `Updated user`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<UserDTO>(UserDTO.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    content: {
      json: {
        examples: {
          invalidFile: {
            value: new BadRequestException('Missing file'),
          },
          onlyImages: {
            value: new BadRequestException('Only image files are allowed'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
          itsNotYou: {
            value: new ForbiddenException('You are not allowed to update the photo of this user'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    content: {
      json: {
        examples: {
          invalidId: {
            value: new BadRequestException('Error uploading file'),
          },
        },
      },
    },
  })
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
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Upload a profile picture for a team`,
    description: `Allows uploading a profile picture for a user the image`,
  })
  @ApiResponse({
    status: 201,
    description: `Updated user`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<UserDTO>(UserDTO.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    content: {
      json: {
        examples: {
          invalidFile: {
            value: new BadRequestException('Missing file'),
          },
          onlyImages: {
            value: new BadRequestException('Only image files are allowed'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
          itsNotYou: {
            value: new ForbiddenException('You are not allowed to update the photo of this user'),
          },
        },
      },
    },
  })
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
  @ApiBearerAuth()
  @ApiOperation({
    summary: `Verify captcha`,
    description: `Allows verifying captcha`,
  })
  @ApiResponse({
    status: 201,
    description: `Captcha verfication result`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<boolean>(true),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
        },
      },
    },
  })
  public async verifyCaptcha(@CurrentToken() token: Token, @Body() data: VerifyCaptchaRequestDto): Promise<NormalizedResponseDTO<boolean>> {
    const success: boolean = await this.usersService.verifyCaptcha(token.id, data);
    return new NormalizedResponseDTO(success);
  }

  @Post('email-recovery-password')
  @Public()
  @ApiResponse({
    status: 201,
    description: `Email sent`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<boolean>(true),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    content: {
      json: {
        examples: {
          invalidCaptcha: {
            value: new BadRequestException('Invalid captcha'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          notFound: {
            value: new NotFoundException('User not found'),
          },
        },
      },
    },
  })
  public async sendEmailRecoveryPassword(@Body() emailUserChangePasswordDTO: EmailUserChangePasswordDTO): Promise<NormalizedResponseDTO<boolean>> {
    const success: boolean = await this.usersService.sendEmailRecoveryPassword(emailUserChangePasswordDTO);
    return new NormalizedResponseDTO(success);
  }

  @Post('change-password')
  @Public()
  @ApiResponse({
    status: 201,
    description: `Password changed`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<boolean>(true),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          notFound: {
            value: new NotFoundException('Token not found for this email'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          recoveryPassUsed: {
            value: new ForbiddenException('Recovery password token already used'),
          },
          recoveryPassExpired: {
            value: new ForbiddenException('Recovery password token expired'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    content: {
      json: {
        examples: {
          samePass: {
            value: new ConflictException('New password must be different from the old one'),
          },
        },
      },
    },
  })
  public async changePassword(@Body() userChangePasswordDto: UserChangePasswordDTO): Promise<NormalizedResponseDTO<boolean>> {
    const success: boolean = await this.usersService.changePassword(userChangePasswordDto);
    return new NormalizedResponseDTO(success);
  }

  @Post('email-in-use')
  @Public()
  @ApiResponse({
    status: 201,
    description: `Email in use`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<boolean>(false),
          },
        },
      },
    },
  })
  public async emailInUse(@Body() emailInUseDTO: EmailInUseDTO): Promise<NormalizedResponseDTO<boolean>> {
    const success: boolean = await this.usersService.emailInUse(emailInUseDTO);
    return new NormalizedResponseDTO(success);
  }
}
