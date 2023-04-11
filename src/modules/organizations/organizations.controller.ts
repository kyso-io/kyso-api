import {
  AddUserOrganizationDto,
  ChangeRequestAccessDTO,
  CreateOrganizationDto,
  GlobalPermissionsEnum,
  InviteUserDto,
  JoinCodes,
  NormalizedResponseDTO,
  Organization,
  OrganizationInfoDto,
  OrganizationMember,
  OrganizationMemberJoin,
  OrganizationOptions,
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
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  PreconditionFailedException,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiExtraModels, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Parser } from 'json2csv';
import { Public } from 'src/decorators/is-public';
import { PlatformRole } from 'src/security/platform-roles';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
import { Autowired } from '../../decorators/autowired';
import { GenericController } from '../../generic/controller.generic';
import { QueryParser } from '../../helpers/queryParser';
import slugify from '../../helpers/slugify';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { Permission } from '../auth/annotations/permission.decorator';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { SolvedCaptchaGuard } from '../auth/guards/solved-captcha.guard';
import { RelationsService } from '../relations/relations.service';
import { RequestAccessService } from '../request-access/request-access.service';
import { TeamsService } from '../teams/teams.service';
import { UsersService } from '../users/users.service';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@ApiExtraModels(Organization)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController extends GenericController<Organization> {
  @Autowired({ typeName: 'RelationsService' })
  private relationsService: RelationsService;

  @Autowired({ typeName: 'UsersService' })
  private usersService: UsersService;

  @Autowired({ typeName: 'RequestAccessService' })
  private requestAccessService: RequestAccessService;

  @Autowired({ typeName: 'TeamsService' })
  private teamsService: TeamsService;

  constructor(private readonly organizationService: OrganizationsService) {
    super();
  }

  @Get()
  @ApiOperation({
    summary: `Get organizations`,
    description: `Allows fetching list of organizations`,
  })
  @Public()
  @ApiNormalizedResponse({ status: 200, description: `List of organizations`, type: Organization, isArray: true })
  async getOrganizations(@CurrentToken() token: Token, @Req() req): Promise<NormalizedResponseDTO<Organization[]>> {
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
    /*
        if (!token.isGlobalAdmin()) {
            const userInOrganizations: OrganizationMemberJoin[] = await this.organizationService.searchMembersJoin({
                filter: {
                    member_id: token.id,
                },
            })
            query.filter._id = {
                $in: userInOrganizations.map((o: OrganizationMemberJoin) => new ObjectId(o.organization_id)),
            }
        }*/
    const organizations: Organization[] = await this.organizationService.getOrganizations(query);
    return new NormalizedResponseDTO(organizations);
  }

  @Get('/info')
  @Public()
  @ApiOperation({
    summary: `Get the number of members, reports, discussions and comments by organization`,
    description: `Allows fetching the number of members, reports, discussions and comments by organization`,
  })
  @ApiNormalizedResponse({ status: 200, description: `Number of members and reports by organization`, type: OrganizationInfoDto })
  public async getOrganizationsInfo(@CurrentToken() token: Token, @Query('organizationId') organizationId: string): Promise<NormalizedResponseDTO<OrganizationInfoDto[]>> {
    const organizationInfoDto: OrganizationInfoDto[] = await this.organizationService.getOrganizationsInfo(token, organizationId);
    const relations = await this.relationsService.getRelations(organizationInfoDto);
    return new NormalizedResponseDTO(organizationInfoDto, relations);
  }

  @Get('/:sluglified_name/storage')
  @ApiOperation({
    summary: `Get organization storage`,
    description: `Allows fetching organization storage`,
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
  @ApiNormalizedResponse({ status: 200, description: `Organization matching id`, type: Organization })
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
  @Public()
  @ApiNormalizedResponse({ status: 200, description: `Organization matching id`, type: Organization })
  async getOrganizationById(@CurrentToken() token: Token, @Param('organizationId') organizationId: string): Promise<NormalizedResponseDTO<Organization>> {
    const organization: Organization = await this.organizationService.getOrganizationById(organizationId);
    if (!organization) {
      throw new PreconditionFailedException('Organization not found');
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
  @ApiNormalizedResponse({ status: 200, description: `Organization matching id`, type: Organization })
  @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN, OrganizationPermissionsEnum.ADMIN, OrganizationPermissionsEnum.DELETE])
  public async deleteOrganization(@CurrentToken() token: Token, @Param('organizationId') organizationId: string): Promise<NormalizedResponseDTO<Organization>> {
    const organization: Organization = await this.organizationService.deleteOrganization(token, organizationId);
    return new NormalizedResponseDTO(organization);
  }

  @Get('/:organizationId/members')
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
  @ApiNormalizedResponse({ status: 200, description: `Organization members`, type: OrganizationMember, isArray: true })
  @Public()
  async getOrganizationMembers(@Param('organizationId') organizationId: string): Promise<NormalizedResponseDTO<OrganizationMember[]>> {
    const data: OrganizationMember[] = await this.organizationService.getOrganizationMembers(organizationId);
    return new NormalizedResponseDTO(data);
  }

  @Get('/:organizationId/members/export')
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
  @Permission([OrganizationPermissionsEnum.ADMIN])
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
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Create a join codes for an organization`,
    description: `Allows creating a join codes for an organization`,
  })
  @ApiBody({
    type: UpdateJoinCodesDto,
    description: `Generate join codes for an organization`,
  })
  @Permission([OrganizationPermissionsEnum.ADMIN])
  async createJoinCodes(@CurrentToken() token: Token, @Param('organizationId') organizationId: string, @Body() updateJoinCodesDto: UpdateJoinCodesDto): Promise<NormalizedResponseDTO<JoinCodes>> {
    const organizationResourcePermissions: ResourcePermissions | undefined = token.permissions.organizations.find(
      (resourcePermissions: ResourcePermissions) => resourcePermissions.id === organizationId,
    );
    const isGlobalAdmin: boolean = token.permissions.global.includes(GlobalPermissionsEnum.GLOBAL_ADMIN);
    const isOrgAdmin: boolean = organizationResourcePermissions ? organizationResourcePermissions.permissions.includes(OrganizationPermissionsEnum.ADMIN) : false;
    if (!isGlobalAdmin && !isOrgAdmin) {
      throw new ForbiddenException('You are not allowed generate join codes for this organization');
    }
    const joinCodes: JoinCodes = await this.organizationService.createJoinCodes(organizationId, updateJoinCodesDto);
    return new NormalizedResponseDTO(joinCodes);
  }

  @Patch('/:organizationId/join-codes')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Update a join codes for an organization`,
    description: `Allows updating a join codes for an organization`,
  })
  @ApiBody({
    type: UpdateJoinCodesDto,
    description: `Update join codes for an organization`,
  })
  @Permission([OrganizationPermissionsEnum.ADMIN])
  async updateJoinCodes(@CurrentToken() token: Token, @Param('organizationId') organizationId: string, @Body() updateJoinCodesDto: UpdateJoinCodesDto): Promise<NormalizedResponseDTO<JoinCodes>> {
    const organizationResourcePermissions: ResourcePermissions | undefined = token.permissions.organizations.find(
      (resourcePermissions: ResourcePermissions) => resourcePermissions.id === organizationId,
    );
    const isGlobalAdmin: boolean = token.permissions.global.includes(GlobalPermissionsEnum.GLOBAL_ADMIN);
    const isOrgAdmin: boolean = organizationResourcePermissions ? organizationResourcePermissions.permissions.includes(OrganizationPermissionsEnum.ADMIN) : false;
    if (!isGlobalAdmin && !isOrgAdmin) {
      throw new ForbiddenException('You are not allowed update join codes for this organization');
    }
    const joinCodes: JoinCodes = await this.organizationService.updateJoinCodes(organizationId, updateJoinCodesDto);
    return new NormalizedResponseDTO(joinCodes);
  }

  @Post('invitation')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Create an invitation`,
    description: `Create an invitation`,
  })
  @ApiBody({
    description: 'Invite user to the organization',
    required: true,
    type: InviteUserDto,
    examples: InviteUserDto.examples(),
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
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Create a new organization`,
    description: `By passing the appropiate parameters you can create a new organization`,
  })
  @ApiBody({
    description: 'Create organization',
    required: true,
    type: CreateOrganizationDto,
    examples: CreateOrganizationDto.examples(),
  })
  @ApiNormalizedResponse({ status: 201, description: `Created organization`, type: Organization })
  async createOrganization(@CurrentToken() token: Token, @Body() createOrganizationDto: CreateOrganizationDto): Promise<NormalizedResponseDTO<Organization>> {
    const slugName: string = slugify(createOrganizationDto.display_name);
    const existsOrganization: Organization = await this.organizationService.getOrganizationBySlugName(slugName);
    if (!existsOrganization) {
      const organization: Organization = await this.organizationService.createOrganization(token, createOrganizationDto);
      return new NormalizedResponseDTO(organization);
    } else {
      throw new PreconditionFailedException('This organization already exists at Kyso');
    }
  }

  @Patch('/:organizationId')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Update an organization`,
    description: `By passing the appropiate parameters you can update an organization`,
  })
  @ApiBody({
    description: 'Update organization',
    required: true,
    type: UpdateOrganizationDTO,
    examples: UpdateOrganizationDTO.examples(),
  })
  @ApiNormalizedResponse({ status: 200, description: `Updated organization`, type: Organization })
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
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Update organization options`,
    description: `By passing the appropiate parameters you can update an organization's options`,
  })
  @ApiNormalizedResponse({ status: 200, description: `Updated organization`, type: Organization })
  @ApiBody({
    description: 'Update organization',
    required: true,
    type: OrganizationOptions,
    examples: OrganizationOptions.examples(),
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
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Add user to an organization`,
    description: `By passing the appropiate parameters you can add a user to an organization`,
  })
  @ApiBody({
    description: 'Add user to the organization',
    required: true,
    type: AddUserOrganizationDto,
    examples: AddUserOrganizationDto.examples(),
  })
  @ApiNormalizedResponse({ status: 201, description: `Added user`, type: OrganizationMember, isArray: false })
  @Permission([OrganizationPermissionsEnum.ADMIN])
  public async addMemberToOrganization(@Body() addUserOrganizationDto: AddUserOrganizationDto): Promise<NormalizedResponseDTO<OrganizationMember[]>> {
    const members: OrganizationMember[] = await this.organizationService.addMemberToOrganization(addUserOrganizationDto);
    return new NormalizedResponseDTO(members);
  }

  @Post('/:organizationName/join/:invitationCode')
  // @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Add user to an organization`,
    description: `By passing the appropiate parameters you can add a user to an organization`,
  })
  @ApiNormalizedResponse({ status: 201, description: `Added user`, type: OrganizationMember, isArray: true })
  @ApiParam({
    name: 'organizationName',
    required: true,
    description: `Id of the organization to add the user to`,
    schema: { type: 'string' },
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
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Remove user from the organization`,
    description: `By passing the appropiate parameters you can remove a user from the organization`,
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
  @ApiNormalizedResponse({ status: 200, description: `Added user`, type: OrganizationMember, isArray: true })
  @Permission([OrganizationPermissionsEnum.ADMIN])
  public async removeMemberFromOrganization(@Param('organizationId') organizationId, @Param('userId') userId: string): Promise<NormalizedResponseDTO<boolean>> {
    const members: OrganizationMember[] = await this.organizationService.removeMemberFromOrganization(organizationId, userId);
    return new NormalizedResponseDTO(members);
  }

  @Post('/:organizationId/members-roles')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Update the members of an organization`,
    description: `By passing the appropiate parameters you can update the roles of the members of an organization`,
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
    type: AddUserOrganizationDto,
    examples: AddUserOrganizationDto.examples(),
  })
  @ApiNormalizedResponse({ status: 201, description: `Updated organization`, type: OrganizationMember, isArray: true })
  @Permission([OrganizationPermissionsEnum.ADMIN])
  public async UpdateOrganizationMembersDTORoles(@Param('organizationId') organizationId: string, @Body() data: UpdateOrganizationMembersDTO): Promise<NormalizedResponseDTO<OrganizationMember[]>> {
    const organizationMembers: OrganizationMember[] = await this.organizationService.updateOrganizationMembersDTORoles(organizationId, data);
    return new NormalizedResponseDTO(organizationMembers);
  }

  @Delete('/:organizationId/members-roles/:userId/:role')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Remove a user's role in an organization`,
    description: `By passing the appropiate parameters you can remove a role of a member in an organization`,
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
  @ApiNormalizedResponse({ status: 200, description: `Updated organization`, type: Boolean })
  @Permission([OrganizationPermissionsEnum.ADMIN])
  public async removeOrganizationMemberRole(
    @Param('organizationId') organizationId: string,
    @Param('userId') userId: string,
    @Param('role') role: string,
  ): Promise<NormalizedResponseDTO<OrganizationMember[]>> {
    const members: OrganizationMember[] = await this.organizationService.removeOrganizationMemberRole(organizationId, userId, role);
    return new NormalizedResponseDTO(members);
  }

  @UseInterceptors(FileInterceptor('file'))
  @Post('/:organizationId/profile-picture')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Upload a profile picture for a organization`,
    description: `Allows uploading a profile picture for a organization passing its id and image`,
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
  @ApiNormalizedResponse({ status: 201, description: `Updated organization`, type: Organization })
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
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Delete a profile picture for a organization`,
    description: `Allows deleting a profile picture for a organization passing its id`,
  })
  @ApiParam({
    name: 'organizationId',
    required: true,
    description: `Id of the organization to fetch`,
    schema: { type: 'string' },
  })
  @ApiNormalizedResponse({ status: 200, description: `Updated organization`, type: Organization })
  public async deleteBackground(@Param('organizationId') organizationId: string): Promise<NormalizedResponseDTO<Organization>> {
    const organization: Organization = await this.organizationService.deleteProfilePicture(organizationId);
    return new NormalizedResponseDTO(organization);
  }

  @Public()
  @Get('/:organizationSlug/reports')
  @ApiParam({
    name: 'organizationSlug',
    required: true,
    description: `Slug of the organization to fetch reports`,
    schema: { type: 'string' },
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
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Request access to an organization`,
    description: `By passing the appropiate parameters you request access to an organization`,
  })
  @ApiNormalizedResponse({ status: 200, description: `Request created successfully`, type: RequestAccess })
  public async requestAccessToAnOrganization(@CurrentToken() token: Token, @Param('organizationSlug') organizationSlug: string): Promise<NormalizedResponseDTO<RequestAccess>> {
    const requestAccess: RequestAccess = await this.requestAccessService.requestAccessToOrganization(token.id, organizationSlug);
    return new NormalizedResponseDTO<RequestAccess>(requestAccess);
  }

  @Public()
  @Get('/:organizationId/request-access/:requestAccessId/:secret/:changerId/:newStatus')
  @ApiOperation({
    summary: `Request access to an organization`,
    description: `By passing the appropiate parameters you request access to an organization`,
  })
  @ApiNormalizedResponse({ status: 200, description: `Request changed successfully`, type: String })
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

  @Public()
  @Get('/:organizationSlug/team/:teamSlug/visibility')
  @ApiOperation({
    summary: `Returns the visibility and teamId of a team under an organization`,
    description: `By passing the appropiate parameters you can know the visibility of a team`,
  })
  @ApiNormalizedResponse({ status: 200, description: `Success`, type: String })
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
