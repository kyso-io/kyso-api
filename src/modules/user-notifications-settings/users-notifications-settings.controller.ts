import {
  NormalizedResponseDTO,
  NotificationsSettings,
  Organization,
  Team,
  Token,
  UpdateUserNotificationsSettings,
  UserNotificationsSettings,
  UserNotificationsSettingsScope,
} from '@kyso-io/kyso-model';
import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  @ApiResponse({
    status: 200,
    description: `User notifications settings`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<UserNotificationsSettings>(new UserNotificationsSettings('647f368021b67cfee3131520')),
          },
        },
      },
    },
  })
  public async getUserNotificationsSettingsByUserId(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<UserNotificationsSettings>> {
    const userNotificationsSettings: UserNotificationsSettings = await this.usersNotificationsServiceService.getUserNotificationsSettingsByUserId(token.id);
    return new NormalizedResponseDTO<UserNotificationsSettings>(userNotificationsSettings);
  }

  @Put()
  @ApiBody({
    description: 'Update user notifications settings',
    required: true,
    examples: {
      json: {
        value: new UpdateUserNotificationsSettings(UserNotificationsSettingsScope.Global, new NotificationsSettings()),
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: `Updated user notifications settings`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<UserNotificationsSettings>(new UserNotificationsSettings('647f368021b67cfee3131520')),
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
            value: new BadRequestException('Invalid scope'),
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
            value: new NotFoundException('User does not have notifications settings'),
          },
        },
      },
    },
  })
  public async updateUserNotificationsSettingsGlobal(
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
  @ApiResponse({
    status: 200,
    description: `Updated user notifications settings`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<UserNotificationsSettings>(new UserNotificationsSettings('647f368021b67cfee3131520')),
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
          invalidOrgId: {
            value: new BadRequestException('Invalid organization_id'),
          },
          invalidScope: {
            value: new BadRequestException('Invalid scope'),
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
          notFound: {
            value: new NotFoundException('User does not have notifications settings'),
          },
        },
      },
    },
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
  @ApiResponse({
    status: 200,
    description: `Updated user notifications settings`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<UserNotificationsSettings>(new UserNotificationsSettings('647f368021b67cfee3131520')),
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
          invalidOrgId: {
            value: new BadRequestException('Invalid organization_id'),
          },
          invalidChannelId: {
            value: new BadRequestException('Invalid channel_id'),
          },
          invalidScope: {
            value: new BadRequestException('Invalid scope'),
          },
          channelDoesNotBelongToOrg: {
            value: new BadRequestException('Channel does not belong to organization'),
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
          channelNotFound: {
            value: new NotFoundException('Channel not found'),
          },
          notFound: {
            value: new NotFoundException('User does not have notifications settings'),
          },
        },
      },
    },
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
  @ApiResponse({
    status: 200,
    description: `Updated user notifications settings`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<UserNotificationsSettings>(new UserNotificationsSettings('647f368021b67cfee3131520')),
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
          invalidOrgId: {
            value: new BadRequestException('Invalid organization_id'),
          },
          invalidScope: {
            value: new BadRequestException('Invalid scope'),
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
          notFound: {
            value: new NotFoundException('User does not have notifications settings'),
          },
        },
      },
    },
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
  @ApiResponse({
    status: 200,
    description: `Updated user notifications settings`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<UserNotificationsSettings>(new UserNotificationsSettings('647f368021b67cfee3131520')),
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
          invalidOrgId: {
            value: new BadRequestException('Invalid organization_id'),
          },
          invalidChannelId: {
            value: new BadRequestException('Invalid channel_id'),
          },
          invalidScope: {
            value: new BadRequestException('Invalid scope'),
          },
          channelDoesNotBelongToOrg: {
            value: new BadRequestException('Channel does not belong to organization'),
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
          channelNotFound: {
            value: new NotFoundException('Channel not found'),
          },
          notFound: {
            value: new NotFoundException('User does not have notifications settings'),
          },
        },
      },
    },
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
