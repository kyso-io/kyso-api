import { NormalizedResponseDTO, Organization, Team, Token, UpdateUserNotificationsSettings, UserNotificationsSettings, UserNotificationsSettingsScope } from '@kyso-io/kyso-model';
import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
import { Autowired } from '../../decorators/autowired';
import { GenericController } from '../../generic/controller.generic';
import { Validators } from '../../helpers/validators';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { OrganizationsService } from '../organizations/organizations.service';
import { TeamsService } from '../teams/teams.service';
import { UsersNotificationsServiceService } from './users-notifications-settings.service';

@ApiTags('users-notifications-settings')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('users-notifications-settings')
export class UsersNotificationsSettingsController extends GenericController<UserNotificationsSettings> {
  @Autowired({ typeName: 'UsersNotificationsServiceService' })
  private usersNotificationsServiceService: UsersNotificationsServiceService;

  @Autowired({ typeName: 'OrganizationsService' })
  private organizationsService: OrganizationsService;

  @Autowired({ typeName: 'TeamsService' })
  private teamsService: TeamsService;

  @Get()
  @ApiOperation({
    summary: `Get user notifications settings`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `User notifications settings`,
    type: UserNotificationsSettings,
    isArray: true,
  })
  public async getUserNotificationsSettingsByUserId(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<UserNotificationsSettings>> {
    const userNotificationsSettings: UserNotificationsSettings = await this.usersNotificationsServiceService.getUserNotificationsSettingsByUserId(token.id);
    return new NormalizedResponseDTO<UserNotificationsSettings>(userNotificationsSettings);
  }

  @Put()
  @ApiNormalizedResponse({
    status: 200,
    description: `Updated user notifications settings`,
    type: UserNotificationsSettings,
    isArray: true,
  })
  public async updateUserNotificationsSettings(
    @CurrentToken() token: Token,
    @Body() updateUserNotificationsSettings: UpdateUserNotificationsSettings,
  ): Promise<NormalizedResponseDTO<UserNotificationsSettings>> {
    if (!updateUserNotificationsSettings.settings) {
      throw new BadRequestException('You must specify a valid settings');
    }
    const userNotificationsSettings: UserNotificationsSettings = await this.usersNotificationsServiceService.updateUserNotificationsSettings(token.id, updateUserNotificationsSettings);
    return new NormalizedResponseDTO<UserNotificationsSettings>(userNotificationsSettings);
  }

  @Put(':organization_id')
  @ApiParam({
    name: 'organization_id',
    required: true,
    description: 'Id of organization',
    schema: { type: 'string' },
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Updated user notifications settings for an organization`,
    type: UserNotificationsSettings,
    isArray: true,
  })
  @ApiResponse({
    status: 400,
    description: 'You must specify an valid organization_id',
  })
  @ApiResponse({
    status: 404,
    description: 'Organization not found',
  })
  public async updateUserNotificationsSettingsOrganization(
    @CurrentToken() token: Token,
    @Param('organization_id') organization_id: string,
    @Body() updateUserNotificationsSettings: UpdateUserNotificationsSettings,
  ): Promise<NormalizedResponseDTO<UserNotificationsSettings>> {
    if (!updateUserNotificationsSettings.settings) {
      throw new BadRequestException('You must specify a valid settings');
    }
    if (!organization_id || !Validators.isValidObjectId(organization_id)) {
      throw new BadRequestException('You must specify an valid organization_id');
    }
    const organization: Organization = await this.organizationsService.getOrganizationById(organization_id);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    const userNotificationsSettings: UserNotificationsSettings = await this.usersNotificationsServiceService.updateUserNotificationsSettings(
      token.id,
      updateUserNotificationsSettings,
      organization_id,
    );
    return new NormalizedResponseDTO<UserNotificationsSettings>(userNotificationsSettings);
  }

  @Put(':organization_id/:channel_id')
  @ApiParam({
    name: 'organization_id',
    required: true,
    description: 'Id of organization',
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'channel_id',
    required: true,
    description: 'Id of channel',
    schema: { type: 'string' },
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Updated user notifications settings for an organization and channel`,
    type: UserNotificationsSettings,
    isArray: true,
  })
  @ApiResponse({
    status: 400,
    description: 'You must specify an valid organization_id or channel_id',
  })
  @ApiResponse({
    status: 404,
    description: 'Organization or channel not found',
  })
  public async updateUserNotificationsSettingsOrganizationChannel(
    @CurrentToken() token: Token,
    @Param('organization_id') organization_id: string,
    @Param('channel_id') channel_id: string,
    @Body() updateUserNotificationsSettings: UpdateUserNotificationsSettings,
  ): Promise<NormalizedResponseDTO<UserNotificationsSettings>> {
    if (!updateUserNotificationsSettings.settings) {
      throw new BadRequestException('You must specify a valid settings');
    }
    if (!organization_id || !Validators.isValidObjectId(organization_id)) {
      throw new BadRequestException('You must specify an valid organization_id');
    }
    if (!channel_id || !Validators.isValidObjectId(channel_id)) {
      throw new BadRequestException('You must specify an valid channel_id');
    }
    const organization: Organization = await this.organizationsService.getOrganizationById(organization_id);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    const team: Team = await this.teamsService.getTeamById(channel_id);
    if (!team) {
      throw new NotFoundException('Channel not found');
    }
    if (organization.id !== team.organization_id) {
      throw new BadRequestException('Channel does not belong to organization');
    }
    const userNotificationsSettings: UserNotificationsSettings = await this.usersNotificationsServiceService.updateUserNotificationsSettings(
      token.id,
      updateUserNotificationsSettings,
      organization_id,
      channel_id,
    );
    return new NormalizedResponseDTO<UserNotificationsSettings>(userNotificationsSettings);
  }

  @Delete(':organization_id')
  @ApiParam({
    name: 'organization_id',
    required: true,
    description: 'Id of organization',
    schema: { type: 'string' },
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Delete user notifications settings for an organization`,
    type: UserNotificationsSettings,
    isArray: true,
  })
  @ApiResponse({
    status: 400,
    description: 'You must specify an valid organization_id',
  })
  @ApiResponse({
    status: 404,
    description: 'Organization not found',
  })
  public async deleteUserNotificationsSettingsOrganization(@CurrentToken() token: Token, @Param('organization_id') organization_id: string): Promise<NormalizedResponseDTO<UserNotificationsSettings>> {
    if (!organization_id || !Validators.isValidObjectId(organization_id)) {
      throw new BadRequestException('You must specify an valid organization_id');
    }
    const organization: Organization = await this.organizationsService.getOrganizationById(organization_id);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    const userNotificationsSettings: UserNotificationsSettings = await this.usersNotificationsServiceService.deleteUserNotificationSettingsGivenScope(
      token.id,
      UserNotificationsSettingsScope.Organization,
      organization_id,
    );
    return new NormalizedResponseDTO<UserNotificationsSettings>(userNotificationsSettings);
  }

  @Delete(':organization_id/:channel_id')
  @ApiParam({
    name: 'organization_id',
    required: true,
    description: 'Id of organization',
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'channel_id',
    required: true,
    description: 'Id of channel',
    schema: { type: 'string' },
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Delete user notifications settings for an organization and channel`,
    type: UserNotificationsSettings,
    isArray: true,
  })
  @ApiResponse({
    status: 400,
    description: 'You must specify an valid organization_id or channel_id',
  })
  @ApiResponse({
    status: 404,
    description: 'Organization or channel not found',
  })
  public async deleteUserNotificationsSettingsOrganizationChannel(
    @CurrentToken() token: Token,
    @Param('organization_id') organization_id: string,
    @Param('channel_id') channel_id: string,
  ): Promise<NormalizedResponseDTO<UserNotificationsSettings>> {
    if (!organization_id || !Validators.isValidObjectId(organization_id)) {
      throw new BadRequestException('You must specify an valid organization_id');
    }
    if (!channel_id || !Validators.isValidObjectId(channel_id)) {
      throw new BadRequestException('You must specify an valid channel_id');
    }
    const organization: Organization = await this.organizationsService.getOrganizationById(organization_id);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    const team: Team = await this.teamsService.getTeamById(channel_id);
    if (!team) {
      throw new NotFoundException('Channel not found');
    }
    if (organization.id !== team.organization_id) {
      throw new BadRequestException('Channel does not belong to organization');
    }
    const userNotificationsSettings: UserNotificationsSettings = await this.usersNotificationsServiceService.deleteUserNotificationSettingsGivenScope(
      token.id,
      UserNotificationsSettingsScope.Channel,
      organization_id,
      channel_id,
    );
    return new NormalizedResponseDTO<UserNotificationsSettings>(userNotificationsSettings);
  }
}
