import {
  AddUserOrganizationDto,
  AllowDownload,
  ChangeRequestAccessDTO,
  CreateOrganizationDto,
  GlobalPermissionsEnum,
  HEADER_X_KYSO_ORGANIZATION,
  InviteUserDto,
  JoinCodes,
  KysoSettingsEnum,
  NormalizedResponseDTO,
  Organization,
  OrganizationInfoDto,
  OrganizationMember,
  OrganizationMemberJoin,
  OrganizationOptions,
  OrganizationOptionsDTO,
  OrganizationPermissionsEnum,
  OrganizationStorageDto,
  PaginatedResponseDto,
  Relations,
  ReportDTO,
  RequestAccess,
  RequestAccessStatusEnum,
  ResourcePermissions,
  StoragePermissionsEnum,
  Team,
  TeamMember,
  TeamPermissionsEnum,
  TeamVisibilityEnum,
  Token,
  UpdateJoinCodesDto,
  UpdateOrganizationDTO,
  UpdateOrganizationMembersDTO,
  User,
} from '@kyso-io/kyso-model';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiExtraModels, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Parser } from 'json2csv';
import * as moment from 'moment';
import { Public } from 'src/decorators/is-public';
import { PlatformRole } from 'src/security/platform-roles';
import { Autowired } from '../../decorators/autowired';
import { QueryParser } from '../../helpers/queryParser';
import slugify from '../../helpers/slugify';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { Permission } from '../auth/annotations/permission.decorator';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { SolvedCaptchaGuard } from '../auth/guards/solved-captcha.guard';
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service';
import { RelationsService } from '../relations/relations.service';
import { RequestAccessService } from '../request-access/request-access.service';
import { TeamsService } from '../teams/teams.service';
import { UsersService } from '../users/users.service';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@ApiExtraModels(Organization)
@UseGuards(PermissionsGuard)
@Controller('organizations')
export class OrganizationsController {
  @Autowired({ typeName: 'RelationsService' })
  private relationsService: RelationsService;

  @Autowired({ typeName: 'UsersService' })
  private usersService: UsersService;

  @Autowired({ typeName: 'RequestAccessService' })
  private requestAccessService: RequestAccessService;

  @Autowired({ typeName: 'TeamsService' })
  private teamsService: TeamsService;

  @Autowired({ typeName: 'KysoSettingsService' })
  private kysoSettingsService: KysoSettingsService;

  constructor(private readonly organizationService: OrganizationsService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: `Get organizations`,
    description: `Allows fetching list of organizations`,
  })
  @ApiResponse({
    status: 200,
    description: `List of organizations`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<Organization[]>([Organization.createEmpty()]),
          },
        },
      },
    },
  })
  async getOrganizations(@Req() req: Request): Promise<NormalizedResponseDTO<Organization[]>> {
    const query = QueryParser.toQueryObject(req.url);
    if (!query.sort) {
      query.sort = { created_at: -1 };
    }
    query.projection = {
      _id: 1,
      sluglified_name: 1,
      display_name: 1,
      location: 1,
      link: 1,
      bio: 1,
      avatar_url: 1,
      legal_name: 1,
    };
    if (!query.filter) {
      query.filter = {};
    }
    const organizations: Organization[] = await this.organizationService.getOrganizations(query);
    return new NormalizedResponseDTO(organizations);
  }

  @Get('/info')
  @Public()
  @ApiOperation({
    description: `Allows fetching the number of members, reports, discussions and comments by organization`,
    summary: `Get the number of members, reports, discussions and comments by organization`,
  })
  @ApiQuery({
    name: 'organizationId',
    description: 'Organization id',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: `Get the number of members, reports, discussions and comments by organization`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<OrganizationInfoDto[]>([OrganizationInfoDto.createEmpty()]),
          },
        },
      },
    },
  })
  public async getOrganizationsInfo(@CurrentToken() token: Token, @Query('organizationId') organizationId: string): Promise<NormalizedResponseDTO<OrganizationInfoDto[]>> {
    const organizationInfoDto: OrganizationInfoDto[] = await this.organizationService.getOrganizationsInfo(token, organizationId);
    const relations = await this.relationsService.getRelations(organizationInfoDto);
    return new NormalizedResponseDTO(organizationInfoDto, relations);
  }

  @Get('/:sluglified_name/storage')
  @ApiBearerAuth()
  @ApiOperation({
    summary: `Get organization storage`,
    description: `Allows fetching organization storage`,
  })
  @ApiHeader({
    name: HEADER_X_KYSO_ORGANIZATION,
    description: 'active organization (i.e: lightside)',
    required: true,
  })
  @ApiParam({
    name: 'sluglified_name',
    required: true,
    description: `Sluglified name of the organization`,
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: `Get the storage used by organization`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<OrganizationStorageDto>(OrganizationStorageDto.createEmpty()),
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
          notFound: {
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
          notFound: {
            value: new NotFoundException('Organization not found'),
          },
        },
      },
    },
  })
  @Permission([StoragePermissionsEnum.READ])
  public async getOrganizationStorage(@CurrentToken() token: Token, @Param('sluglified_name') sluglified_name: string): Promise<NormalizedResponseDTO<OrganizationStorageDto>> {
    const result: OrganizationStorageDto = await this.organizationService.getOrganizationStorage(token, sluglified_name);
    return new NormalizedResponseDTO(result);
  }

  @Get('/slug/:organizationSlug')
  @Public()
  @ApiOperation({
    summary: `Get an organization given slug`,
    description: `Allows fetching content of a specific organization passing its slug`,
  })
  @ApiParam({
    name: 'organizationSlug',
    required: true,
    description: `Slug of the organization to fetch`,
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: `Organization content`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<Organization>(Organization.createEmpty()),
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
            value: new NotFoundException('Organization not found'),
          },
        },
      },
    },
  })
  async getOrganizationBySlug(@CurrentToken() token: Token, @Param('organizationSlug') organizationSlug: string): Promise<NormalizedResponseDTO<Organization>> {
    const organization: Organization = await this.organizationService.getOrganization({
      filter: {
        sluglified_name: organizationSlug,
      },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    let deleteSensitiveData = true;
    if (token) {
      const index: number = token.permissions.organizations.findIndex((o: ResourcePermissions) => o.id === organization.id);
      if (index !== -1) {
        deleteSensitiveData = !token.permissions.organizations[index].permissions.includes(OrganizationPermissionsEnum.ADMIN);
      }
    }
    if (deleteSensitiveData) {
      delete organization?.billingEmail;
      delete organization?.stripe_subscription_id;
      delete organization?.tax_identifier;
      delete organization.options?.notifications;
      delete organization.join_codes;
      delete organization.options?.notifications?.slackToken;
      delete organization.options?.notifications?.slackChannel;
      delete organization.options?.notifications?.teamsIncomingWebhookUrl;
    }
    return new NormalizedResponseDTO(organization);
  }

  @Get('/:organizationId')
  @Public()
  @ApiOperation({
    summary: `Get an organization`,
    description: `Allows fetching content of a specific organization passing its id`,
  })
  @ApiParam({
    name: 'organizationId',
    required: true,
    description: `Id of the organization to fetch`,
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: `Organization content`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<Organization>(Organization.createEmpty()),
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
            value: new NotFoundException('Organization not found'),
          },
        },
      },
    },
  })
  async getOrganizationById(@CurrentToken() token: Token, @Param('organizationId') organizationId: string): Promise<NormalizedResponseDTO<Organization>> {
    const organization: Organization = await this.organizationService.getOrganizationById(organizationId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    let deleteSensitiveData = true;
    if (token) {
      const index: number = token.permissions.organizations.findIndex((o: ResourcePermissions) => o.id === organizationId);
      if (index !== -1) {
        deleteSensitiveData = !token.permissions.organizations[index].permissions.includes(OrganizationPermissionsEnum.ADMIN);
      }
    }
    if (deleteSensitiveData) {
      delete organization?.billingEmail;
      delete organization?.stripe_subscription_id;
      delete organization?.tax_identifier;
      delete organization.options?.notifications;
      delete organization.join_codes;
      delete organization.options?.notifications?.slackToken;
      delete organization.options?.notifications?.slackChannel;
      delete organization.options?.notifications?.teamsIncomingWebhookUrl;
    }
    return new NormalizedResponseDTO(organization);
  }

  @Delete('/:organizationId')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Delete an organization`,
    description: `Allows deleting an organization passing its id`,
  })
  @ApiParam({
    name: 'organizationId',
    required: true,
    description: `Id of the organization to delete`,
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: `Organization content`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<Organization>(Organization.createEmpty()),
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
          notFound: {
            value: new NotFoundException('Organization not found'),
          },
        },
      },
    },
  })
  @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN, OrganizationPermissionsEnum.ADMIN, OrganizationPermissionsEnum.DELETE])
  public async deleteOrganization(@CurrentToken() token: Token, @Param('organizationId') organizationId: string): Promise<NormalizedResponseDTO<Organization>> {
    const organization: Organization = await this.organizationService.deleteOrganization(token, organizationId);
    return new NormalizedResponseDTO(organization);
  }

  @Get('/:organizationId/members')
  @Public()
  @ApiOperation({
    summary: `Get all the members of an organization`,
    description: `Allows fetching content of a specific organization passing its id`,
  })
  @ApiParam({
    name: 'organizationId',
    required: true,
    description: `Id of the organization to fetch`,
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: `Organization members`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<OrganizationMember[]>([OrganizationMember.createEmpty()]),
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
            value: new NotFoundException('Organization not found'),
          },
        },
      },
    },
  })
  async getOrganizationMembers(@Param('organizationId') organizationId: string): Promise<NormalizedResponseDTO<OrganizationMember[]>> {
    const data: OrganizationMember[] = await this.organizationService.getOrganizationMembers(organizationId);
    return new NormalizedResponseDTO(data);
  }

  @Get('/:organizationId/members/export')
  @ApiBearerAuth()
  @ApiOperation({
    summary: `Export members of an organization in csv`,
    description: `Allows exporting members of an organization in csv`,
  })
  @ApiParam({
    name: 'organizationId',
    required: true,
    description: `Id of the organization to fetch`,
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: `Organization members in csv`,
    type: Buffer,
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException('You are not allowed to access this resource'),
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
            value: new NotFoundException('Organization not found'),
          },
        },
      },
    },
  })
  async exportOrganizationMembers(@CurrentToken() token: Token, @Param('organizationId') organizationId: string, @Res() response: Response): Promise<void> {
    const organization: Organization = await this.organizationService.getOrganizationById(organizationId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    const organizationResourcePermissions: ResourcePermissions | undefined = token.permissions.organizations.find(
      (resourcePermissions: ResourcePermissions) => resourcePermissions.id === organizationId,
    );
    if (!organizationResourcePermissions || !organizationResourcePermissions.permissions.includes(OrganizationPermissionsEnum.ADMIN)) {
      throw new ForbiddenException('You are not allowed to access this resource');
    }
    const organizationMembersJoin: OrganizationMemberJoin[] = await this.organizationService.getMembers(organizationId);
    const data: { display_name: string; email: string; created_at: string; last_login: string }[] = [];
    for (const organizationMemberJoin of organizationMembersJoin) {
      const user: User = await this.usersService.getUserById(organizationMemberJoin.member_id);
      if (!user) {
        continue;
      }
      data.push({
        display_name: user.display_name,
        email: user.email,
        created_at: user.created_at.toISOString(),
        last_login: user.last_login ? user.last_login.toISOString() : '',
      });
    }
    // Sort by display_name
    data.sort((a, b) => {
      const display_name_a: string = a.display_name.toLowerCase();
      const display_name_b: string = b.display_name.toLowerCase();
      if (display_name_b > display_name_a) {
        return -1;
      } else if (display_name_b < display_name_a) {
        return 1;
      } else {
        return 0;
      }
    });
    const parser = new Parser();
    const csv: string = parser.parse(data);
    response.setHeader('Content-Type', 'text/csv');
    response.setHeader('Content-Disposition', `attachment; filename=${organization.sluglified_name}-members.csv`);
    response.send(csv);
  }

  @Post('/:organizationId/join-codes')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Create a join codes for an organization`,
    description: `Allows creating a join codes for an organization`,
  })
  @ApiBody({
    type: UpdateJoinCodesDto,
    description: `Generate join codes for an organization`,
    required: true,
    examples: {
      json: {
        value: new UpdateJoinCodesDto(true, moment().add(1, 'month').toDate()),
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: `Organization content`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<Organization>(Organization.createEmpty()),
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
          expirationDate: {
            value: new BadRequestException('Expiration date can not be higher than 3 months'),
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
          invitationLinksNotEnabled: {
            value: new ForbiddenException('Invitation links not enabled'),
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
            value: new NotFoundException('Organization not found'),
          },
        },
      },
    },
  })
  @Permission([OrganizationPermissionsEnum.ADMIN])
  async createJoinCodes(@Param('organizationId') organizationId: string, @Body() updateJoinCodesDto: UpdateJoinCodesDto): Promise<NormalizedResponseDTO<JoinCodes>> {
    const joinCodes: JoinCodes = await this.organizationService.createJoinCodes(organizationId, updateJoinCodesDto);
    return new NormalizedResponseDTO(joinCodes);
  }

  @Patch('/:organizationId/join-codes')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Update a join codes for an organization`,
    description: `Allows updating a join codes for an organization`,
  })
  @ApiBody({
    description: `Update join codes for an organization`,
    required: true,
    examples: {
      json: {
        value: new UpdateJoinCodesDto(true, moment().add(1, 'month').toDate()),
      },
    },
  })
  @ApiResponse({
    status: 400,
    content: {
      json: {
        examples: {
          expirationDate: {
            value: new BadRequestException('Expiration date can not be higher than 3 months'),
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
          invitationLinksNotEnabled: {
            value: new ForbiddenException('Invitation links not enabled'),
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
            value: new NotFoundException('Organization not found'),
          },
          notDefinedInvitationCodes: {
            value: new NotFoundException('Organization has not defined invitation codes'),
          },
        },
      },
    },
  })
  async updateJoinCodes(@Param('organizationId') organizationId: string, @Body() updateJoinCodesDto: UpdateJoinCodesDto): Promise<NormalizedResponseDTO<JoinCodes>> {
    const joinCodes: JoinCodes = await this.organizationService.updateJoinCodes(organizationId, updateJoinCodesDto);
    return new NormalizedResponseDTO(joinCodes);
  }

  @Post('invitation')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Create an invitation`,
    description: `Create an invitation`,
  })
  @ApiBody({
    description: 'Invite user to the organization',
    required: true,
    examples: {
      inviteOrg: {
        value: new InviteUserDto('rey@kyso.io', 'lightside', 'organization-admin'),
      },
      inviteTeam: {
        value: new InviteUserDto('rey@kyso.io', 'lightside', 'organization-admin', 'protected-team', 'team-admin'),
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: `Organization and teams members`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<{ organizationMembers: OrganizationMember[]; teamMembers: TeamMember[] }>({
              organizationMembers: [OrganizationMember.createEmpty()],
              teamMembers: [TeamMember.createEmpty()],
            }),
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
          notFound: {
            value: new BadRequestException(`Can't extract the domain of`),
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
            value: new ForbiddenException('User is not authorized to invite other users to organization'),
          },
          emailDomain: {
            value: new ForbiddenException('Email domain not allowed'),
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
          orgNotFound: {
            value: new NotFoundException('Organization not found'),
          },
          teamNotFound: {
            value: new NotFoundException('Team not found'),
          },
        },
      },
    },
  })
  @Permission([OrganizationPermissionsEnum.ADMIN, TeamPermissionsEnum.ADMIN])
  public async inviteNewUser(
    @CurrentToken() token: Token,
    @Body() inviteUserDto: InviteUserDto,
  ): Promise<NormalizedResponseDTO<{ organizationMembers: OrganizationMember[]; teamMembers: TeamMember[] }>> {
    const result: { organizationMembers: OrganizationMember[]; teamMembers: TeamMember[] } = await this.organizationService.inviteNewUser(token, inviteUserDto);
    return new NormalizedResponseDTO(result);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Create a new organization`,
    description: `By passing the appropiate parameters you can create a new organization`,
  })
  @ApiBody({
    description: 'Create organization',
    required: true,
    examples: {
      json: {
        value: new CreateOrganizationDto('Google', 'Global search', 'USA', 'https://google.com', AllowDownload.ALL),
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: `Organization content`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<Organization>(Organization.createEmpty()),
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
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
          maxOrgsReached: {
            value: new ForbiddenException('You have reached the maximum number of organizations you can create'),
          },
          maxTeamsReached: {
            value: new ForbiddenException('You have reached the maximum number of teams you can create'),
          },
          globalAdminsOnly: {
            value: new ForbiddenException('Only global admins can create organizations'),
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
          orgExists: {
            value: new NotFoundException('Organization already exists'),
          },
        },
      },
    },
  })
  async createOrganization(@CurrentToken() token: Token, @Body() createOrganizationDto: CreateOrganizationDto): Promise<NormalizedResponseDTO<Organization>> {
    const kysoSettingsValue: any = await this.kysoSettingsService.getValue(KysoSettingsEnum.ONLY_GLOBAL_ADMINS_CAN_CREATE_ORGANIZATIONS);
    if (kysoSettingsValue === 'true' || kysoSettingsValue === true) {
      if (!token.isGlobalAdmin()) {
        throw new ForbiddenException('Only global admins can create organizations');
      }
    }
    const slugName: string = slugify(createOrganizationDto.display_name);
    const existsOrganization: Organization = await this.organizationService.getOrganizationBySlugName(slugName);
    if (!existsOrganization) {
      const organization: Organization = await this.organizationService.createOrganization(token, createOrganizationDto);
      return new NormalizedResponseDTO(organization);
    } else {
      throw new ConflictException('This organization already exists at Kyso');
    }
  }

  @Patch('/:organizationId')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Update an organization`,
    description: `By passing the appropiate parameters you can update an organization`,
  })
  @ApiHeader({
    name: HEADER_X_KYSO_ORGANIZATION,
    description: 'active organization (i.e: lightside)',
    required: true,
  })
  @ApiBody({
    description: 'Update organization',
    required: true,
    examples: {
      json: {
        value: new UpdateOrganizationDTO('Google', 'USA', 'https://google.com', 'Global search', [], OrganizationOptionsDTO.createEmpty(), AllowDownload.ALL),
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: `Organization content`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<Organization>(Organization.createEmpty()),
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
          notFound: {
            value: new BadRequestException('Inherited value is invalid for allow_download property at organization level'),
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
          notFound: {
            value: new NotFoundException('Organization not found'),
          },
        },
      },
    },
  })
  @Permission([OrganizationPermissionsEnum.EDIT])
  public async updateOrganization(
    @CurrentToken() token: Token,
    @Param('organizationId') organizationId: string,
    @Body() updateOrganizationDTO: UpdateOrganizationDTO,
  ): Promise<NormalizedResponseDTO<Organization>> {
    const updatedOrganization: Organization = await this.organizationService.updateOrganization(token, organizationId, updateOrganizationDTO);
    return new NormalizedResponseDTO(updatedOrganization);
  }

  @Patch('/:organizationId/options')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Update organization options`,
    description: `By passing the appropiate parameters you can update an organization's options`,
  })
  @ApiParam({
    name: 'organizationId',
    description: 'organization id',
    required: true,
  })
  @ApiHeader({
    name: HEADER_X_KYSO_ORGANIZATION,
    description: 'active organization (i.e: lightside)',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: `Organization content`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<Organization>(Organization.createEmpty()),
          },
        },
      },
    },
  })
  @ApiBody({
    description: 'Update organization',
    required: true,
    examples: {
      json: {
        value: new OrganizationOptionsDTO(),
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
          notFound: {
            value: new NotFoundException('Organization not found'),
          },
        },
      },
    },
  })
  @Permission([OrganizationPermissionsEnum.EDIT])
  public async updateOrganizationOptions(
    @CurrentToken() token: Token,
    @Param('organizationId') organizationId: string,
    @Body() organizationOptions: OrganizationOptions,
  ): Promise<NormalizedResponseDTO<Organization>> {
    const updatedOrganization: Organization = await this.organizationService.updateOrganizationOptions(token, organizationId, organizationOptions);
    return new NormalizedResponseDTO(updatedOrganization);
  }

  @Post('/members')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Add user to an organization`,
    description: `By passing the appropiate parameters you can add a user to an organization`,
  })
  @ApiHeader({
    name: HEADER_X_KYSO_ORGANIZATION,
    description: 'active organization (i.e: lightside)',
    required: true,
  })
  @ApiBody({
    description: 'Add user to the organization',
    required: true,
    examples: {
      json: {
        value: new AddUserOrganizationDto('647f368021b67cfee3131514', '647f367621b67cfee31314b6', 'team-contributor'),
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: `Organization members`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<OrganizationMember[]>([OrganizationMember.createEmpty()]),
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
          emailDomain: {
            value: new ForbiddenException('Email domain not allowed'),
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
            value: new NotFoundException('Organization not found'),
          },
          userNotFound: {
            value: new NotFoundException('User not found'),
          },
        },
      },
    },
  })
  @Permission([OrganizationPermissionsEnum.ADMIN])
  public async addMemberToOrganization(@CurrentToken() token: Token, @Body() addUserOrganizationDto: AddUserOrganizationDto): Promise<NormalizedResponseDTO<OrganizationMember[]>> {
    const members: OrganizationMember[] = await this.organizationService.addMemberToOrganization(addUserOrganizationDto, token);
    return new NormalizedResponseDTO(members);
  }

  @Post('/:organizationName/join/:invitationCode')
  @ApiBearerAuth()
  @ApiOperation({
    summary: `Add user to an organization`,
    description: `By passing the appropiate parameters you can add a user to an organization`,
  })
  @ApiParam({
    name: 'organizationName',
    required: true,
    description: `Id of the organization to add the user to`,
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'invitationCode',
    required: true,
    description: `Invitation code to add the user to the organization`,
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 201,
    description: `Added user`,
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
          invalidInvCode: {
            value: new BadRequestException('Invalid invitation code'),
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
          invitationLinksDisabledGlobally: {
            value: new ForbiddenException('Invitation links are disabled globally'),
          },
          invitationLinksNotDefined: {
            value: new ForbiddenException('The organization does not have defined invitation links'),
          },
          invitationLinksDisabled: {
            value: new ForbiddenException('The organization does not have invitation links activated'),
          },
          invitationLinkExpired: {
            value: new ForbiddenException('Invitation link is expired'),
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
          orgNotFound: {
            value: new NotFoundException('Organization not found'),
          },
          userNotFound: {
            value: new NotFoundException('User not found'),
          },
        },
      },
    },
  })
  public async addUserToOrganization(
    @CurrentToken() token: Token,
    @Param('organizationName') organizationName: string,
    @Param('invitationCode') invitationCode: string,
  ): Promise<NormalizedResponseDTO<boolean>> {
    const result: boolean = await this.organizationService.addUserToOrganization(token.id, organizationName, invitationCode);
    return new NormalizedResponseDTO(result);
  }

  @Delete('/:organizationId/members/:userId')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Remove user from the organization`,
    description: `By passing the appropiate parameters you can remove a user from the organization`,
  })
  @ApiHeader({
    name: HEADER_X_KYSO_ORGANIZATION,
    description: 'active organization (i.e: lightside)',
    required: true,
  })
  @ApiParam({
    name: 'organizationId',
    required: true,
    description: `Id of the organization to remove the user from`,
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'userId',
    required: true,
    description: `Id of the user to remove from the organization`,
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: `Removed user`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<OrganizationMember>([OrganizationMember.createEmpty()]),
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
          userIsNotOrgMember: {
            value: new ForbiddenException('User is not a member of this organization'),
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
          orgNotFound: {
            value: new NotFoundException('Organization not found'),
          },
          userNotFound: {
            value: new NotFoundException('User not found'),
          },
        },
      },
    },
  })
  @Permission([OrganizationPermissionsEnum.ADMIN])
  public async removeMemberFromOrganization(
    @CurrentToken() token: Token,
    @Param('organizationId') organizationId,
    @Param('userId') userId: string,
  ): Promise<NormalizedResponseDTO<OrganizationMember[]>> {
    const members: OrganizationMember[] = await this.organizationService.removeMemberFromOrganization(organizationId, userId, token);
    return new NormalizedResponseDTO<OrganizationMember[]>(members);
  }

  @Post('/:organizationId/members-roles')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Update the members of an organization`,
    description: `By passing the appropiate parameters you can update the roles of the members of an organization`,
  })
  @ApiHeader({
    name: HEADER_X_KYSO_ORGANIZATION,
    description: 'active organization (i.e: lightside)',
    required: true,
  })
  @ApiParam({
    name: 'organizationId',
    required: true,
    description: `Id of the organization to update the members of`,
    schema: { type: 'string' },
  })
  @ApiBody({
    description: "Update user's roles for the organization",
    required: true,
    examples: {
      json: {
        value: new AddUserOrganizationDto('647f368021b67cfee3131514', '647f367621b67cfee31314b6', 'team-contributor'),
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: `Update members`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<OrganizationMember>([OrganizationMember.createEmpty()]),
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
          invalidRole: {
            value: new NotFoundException('Invalid role'),
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
          userNotOrgMember: {
            value: new ForbiddenException('User is not a member of this organization'),
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
          orgNotFound: {
            value: new NotFoundException('Organization not found'),
          },
          userNotFound: {
            value: new NotFoundException('User not found'),
          },
        },
      },
    },
  })
  @Permission([OrganizationPermissionsEnum.ADMIN])
  public async UpdateOrganizationMembersDTORoles(
    @CurrentToken() token: Token,
    @Param('organizationId') organizationId: string,
    @Body() data: UpdateOrganizationMembersDTO,
  ): Promise<NormalizedResponseDTO<OrganizationMember[]>> {
    const organizationMembers: OrganizationMember[] = await this.organizationService.updateOrganizationMembersDTORoles(token, organizationId, data);
    return new NormalizedResponseDTO(organizationMembers);
  }

  @Delete('/:organizationId/members-roles/:userId/:role')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Remove a user's role in an organization`,
    description: `By passing the appropiate parameters you can remove a role of a member in an organization`,
  })
  @ApiHeader({
    name: HEADER_X_KYSO_ORGANIZATION,
    description: 'active organization (i.e: lightside)',
    required: true,
  })
  @ApiParam({
    name: 'organizationId',
    required: true,
    description: `Id of the organization to fetch`,
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'userId',
    required: true,
    description: `Id of the user to fetch`,
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'role',
    required: true,
    description: `Role of the user to fetch`,
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: `Update members`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<OrganizationMember>([OrganizationMember.createEmpty()]),
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
          invalidRole: {
            value: new NotFoundException('User does not have the role'),
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
          userNotOrgMember: {
            value: new ForbiddenException('User is not a member of this organization'),
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
          orgNotFound: {
            value: new NotFoundException('Organization not found'),
          },
          userNotFound: {
            value: new NotFoundException('User not found'),
          },
        },
      },
    },
  })
  @Permission([OrganizationPermissionsEnum.ADMIN])
  public async removeOrganizationMemberRole(
    @Param('organizationId') organizationId: string,
    @Param('userId') userId: string,
    @Param('role') role: string,
  ): Promise<NormalizedResponseDTO<OrganizationMember[]>> {
    const members: OrganizationMember[] = await this.organizationService.removeOrganizationMemberRole(organizationId, userId, role);
    return new NormalizedResponseDTO(members);
  }

  @Post('/:organizationId/profile-picture')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: `Upload a profile picture for a organization`,
    description: `Allows uploading a profile picture for a organization passing its id and image`,
  })
  @ApiHeader({
    name: HEADER_X_KYSO_ORGANIZATION,
    description: 'active organization (i.e: lightside)',
    required: true,
  })
  @ApiParam({
    name: 'organizationId',
    required: true,
    description: `Id of the organization to fetch`,
    schema: { type: 'string' },
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: `Updated organization`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<Organization>(Organization.createEmpty()),
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
          file: {
            value: new NotFoundException('Missing file'),
          },
          image: {
            value: new NotFoundException('Only image files are allowed'),
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
          orgNotFound: {
            value: new NotFoundException('Organization not found'),
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
          error: {
            value: new InternalServerErrorException('Error uploading file'),
          },
        },
      },
    },
  })
  @Permission([OrganizationPermissionsEnum.ADMIN, OrganizationPermissionsEnum.EDIT])
  public async setProfilePicture(@Param('organizationId') organizationId: string, @UploadedFile() file: Express.Multer.File): Promise<NormalizedResponseDTO<Organization>> {
    if (!file) {
      throw new BadRequestException(`Missing file`);
    }
    if (file.mimetype.split('/')[0] !== 'image') {
      throw new BadRequestException(`Only image files are allowed`);
    }
    const organization: Organization = await this.organizationService.setProfilePicture(organizationId, file);
    return new NormalizedResponseDTO(organization);
  }

  @Delete('/:organizationId/profile-picture')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Delete a profile picture for a organization`,
    description: `Allows deleting a profile picture for a organization passing its id`,
  })
  @ApiHeader({
    name: HEADER_X_KYSO_ORGANIZATION,
    description: 'active organization (i.e: lightside)',
    required: true,
  })
  @ApiParam({
    name: 'organizationId',
    required: true,
    description: `Id of the organization to fetch`,
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: `Updated organization`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<Organization>(Organization.createEmpty()),
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
          orgNotFound: {
            value: new NotFoundException('Organization not found'),
          },
        },
      },
    },
  })
  @Permission([OrganizationPermissionsEnum.ADMIN, OrganizationPermissionsEnum.EDIT])
  public async deleteBackground(@Param('organizationId') organizationId: string): Promise<NormalizedResponseDTO<Organization>> {
    const organization: Organization = await this.organizationService.deleteProfilePicture(organizationId);
    return new NormalizedResponseDTO(organization);
  }

  @Get('/:organizationSlug/reports')
  @Public()
  @ApiParam({
    name: 'organizationSlug',
    required: true,
    description: `Slug of the organization to fetch reports`,
    schema: { type: 'string' },
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: `Page number`,
    schema: { type: 'number' },
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: `Number of results per page`,
    schema: { type: 'number' },
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    description: `Sort results by field`,
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: `Organization reports`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<PaginatedResponseDto<ReportDTO>>(PaginatedResponseDto.createEmpty<ReportDTO>()),
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
          orgNotFound: {
            value: new NotFoundException('Organization not found'),
          },
        },
      },
    },
  })
  public async getOrganizationReports(
    @CurrentToken() token: Token,
    @Param('organizationSlug') organizationSlug: string,
    @Query('page') pageStr: string,
    @Query('limit') limitStr: string,
    @Query('sort') sort: string,
  ): Promise<NormalizedResponseDTO<PaginatedResponseDto<ReportDTO>>> {
    let page = 1;
    if (pageStr && !isNaN(pageStr as any)) {
      page = parseInt(pageStr, 10);
    }
    let limit = 30;
    if (limitStr && !isNaN(limitStr as any)) {
      limit = parseInt(limitStr, 10);
    }
    const paginatedResponseDto: PaginatedResponseDto<ReportDTO> = await this.organizationService.getOrganizationReports(token, organizationSlug, page, limit, sort);
    const relations: Relations = await this.relationsService.getRelations(paginatedResponseDto.results, 'report', { Author: 'User' });
    return new NormalizedResponseDTO(paginatedResponseDto, relations);
  }

  @Post('/:organizationSlug/request-access')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Request access to an organization`,
    description: `By passing the appropiate parameters you request access to an organization`,
  })
  @ApiResponse({
    status: 200,
    description: `Request created successfully`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<RequestAccess>(
              new RequestAccess('647f367621b67cfee31314b6', '647f368021b67cfee3131514', '647f368021b67cfee3131516', RequestAccessStatusEnum.PENDING, new Date(), 'secret'),
            ),
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
  public async requestAccessToAnOrganization(@CurrentToken() token: Token, @Param('organizationSlug') organizationSlug: string): Promise<NormalizedResponseDTO<RequestAccess>> {
    const requestAccess: RequestAccess = await this.requestAccessService.requestAccessToOrganization(token.id, organizationSlug);
    return new NormalizedResponseDTO<RequestAccess>(requestAccess);
  }

  @Get('/:organizationId/request-access/:requestAccessId/:secret/:changerId/:newStatus')
  @Public()
  @ApiOperation({
    summary: `Request access to an organization`,
    description: `By passing the appropiate parameters you request access to an organization`,
  })
  @ApiParam({
    name: 'organizationId',
    required: true,
    description: `Id of the organization to fetch`,
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'requestAccessId',
    required: true,
    description: `Id of the request access to fetch`,
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'secret',
    required: true,
    description: `Secret of the request access to fetch`,
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'changerId',
    required: true,
    description: `Id of the user who is changing the status of the request`,
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'newStatus',
    required: true,
    description: `New status of the request`,
    schema: { type: 'string' },
  })
  @ApiResponse({ status: 200, description: `Request changed successfully`, type: String })
  @ApiResponse({
    status: 400,
    content: {
      json: {
        examples: {
          invNewStatus: {
            value: new BadRequestException('Invalid new status'),
          },
          orgIdsMismatch: {
            value: new BadRequestException('Organization identifiers mismatch'),
          },
          invRole: {
            value: new BadRequestException('Invalid role provided. Only reader and contributor roles are permitted'),
          },
          invRequest: {
            value: new BadRequestException('Invalid request provided'),
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
          userNotFound: {
            value: new ForbiddenException('Secrets mismatch'),
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
          orgNotFound: {
            value: new NotFoundException('Organization not found'),
          },
          userNotFound: {
            value: new NotFoundException('User provided not exists'),
          },
        },
      },
    },
  })
  public async changeRequestAccessStatus(
    @Param('organizationId') organizationId: string,
    @Param('requestAccessId') requestAccessId: string,
    @Param('secret') secret: string,
    @Param('changerId') changerId: string,
    @Param('newStatus') newStatus: RequestAccessStatusEnum,
  ) {
    let role;

    switch (RequestAccessStatusEnum[newStatus]) {
      case RequestAccessStatusEnum.ACCEPTED_AS_CONTRIBUTOR:
        role = PlatformRole.TEAM_CONTRIBUTOR_ROLE.name;
        break;
      case RequestAccessStatusEnum.ACCEPTED_AS_READER:
        role = PlatformRole.TEAM_READER_ROLE.name;
        break;
      case RequestAccessStatusEnum.REJECTED:
        role = 'none';
        break;
      default:
        role = null;
        break;
    }

    if (!role) {
      throw new BadRequestException(
        `Invalid newStatus. Valid values are ${RequestAccessStatusEnum.ACCEPTED_AS_CONTRIBUTOR}, ${RequestAccessStatusEnum.ACCEPTED_AS_READER} or ${RequestAccessStatusEnum.REJECTED}`,
      );
    }

    const changeRequest: ChangeRequestAccessDTO = new ChangeRequestAccessDTO(secret, role, newStatus);

    switch (changeRequest.new_status) {
      case RequestAccessStatusEnum.ACCEPTED_AS_CONTRIBUTOR:
      case RequestAccessStatusEnum.ACCEPTED_AS_READER:
        await this.requestAccessService.acceptOrganizationRequest(organizationId, requestAccessId, changeRequest.role, changeRequest.secret, changerId);
        return `Request accepted successfully`;
      case RequestAccessStatusEnum.REJECTED:
        await this.requestAccessService.rejectOrganizationRequest(organizationId, requestAccessId, changeRequest.secret, changerId);
        return `Request rejected successfully`;
      default:
        throw new BadRequestException(`Status provided is invalid`);
    }
  }

  @Get('/:organizationSlug/team/:teamSlug/visibility')
  @Public()
  @ApiOperation({
    summary: `Returns the visibility and teamId of a team under an organization`,
    description: `By passing the appropiate parameters you can know the visibility of a team`,
  })
  @ApiParam({
    name: 'organizationSlug',
    required: true,
    description: `Slug of the organization to fetch`,
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'teamSlug',
    required: true,
    description: `Slug of the team to fetch`,
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: `Updated user notifications settings`,
    content: {
      json: {
        examples: {
          result: {
            value: {
              id: '647f368021b67cfee3131514',
              visibility: TeamVisibilityEnum.PUBLIC,
            },
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
          orgNotFound: {
            value: new NotFoundException('Organization not found'),
          },
          teamNotFound: {
            value: new NotFoundException('Team not found'),
          },
        },
      },
    },
  })
  public async getOrganizationTeamVisibility(
    @Param('organizationSlug') organizationSlug: string,
    @Param('teamSlug') teamSlug: string,
  ): Promise<NormalizedResponseDTO<{ id: string; visibility: TeamVisibilityEnum }>> {
    const organization: Organization = await this.organizationService.getOrganizationBySlugName(organizationSlug);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const team: Team = await this.teamsService.getTeam({
      filter: {
        organization_id: organization.id,
        sluglified_name: teamSlug,
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return new NormalizedResponseDTO({
      id: team.id,
      visibility: team.visibility,
    });
  }
}
