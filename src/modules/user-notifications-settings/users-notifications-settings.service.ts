import { NotificationsSettings, UpdateUserNotificationsSettings, UserNotificationsSettings, UserNotificationsSettingsScope } from '@kyso-io/kyso-model';
import { BadRequestException, ConflictException, Injectable, NotFoundException, Provider } from '@nestjs/common';
import { AutowiredService } from '../../generic/autowired.generic';
import { UserNotificationsSettingsProvider } from './providers/user-notifications-settings.provider';

function factory(service: UsersNotificationsServiceService) {
  return service;
}

export function createProvider(): Provider<UsersNotificationsServiceService> {
  return {
    provide: `${UsersNotificationsServiceService.name}`,
    useFactory: (service) => factory(service),
    inject: [UsersNotificationsServiceService],
  };
}

@Injectable()
export class UsersNotificationsServiceService extends AutowiredService {
  constructor(private readonly provider: UserNotificationsSettingsProvider) {
    super();
  }

  public async getUserNotificationsSettings(query: any): Promise<UserNotificationsSettings> {
    const tags: UserNotificationsSettings[] = await this.provider.read(query);
    if (tags.length === 0) {
      return null;
    }
    return tags[0];
  }

  public async getUserNotificationsSettingsById(id: string): Promise<UserNotificationsSettings> {
    return this.getUserNotificationsSettings({ filter: { _id: this.provider.toObjectId(id) } });
  }

  public async getUserNotificationsSettingsByUserId(user_id: string): Promise<UserNotificationsSettings> {
    return this.getUserNotificationsSettings({ filter: { user_id } });
  }

  public async createUserNotificationsSettings(user_id: string): Promise<UserNotificationsSettings> {
    let uns: UserNotificationsSettings = await this.getUserNotificationsSettingsByUserId(user_id);
    if (uns) {
      throw new ConflictException(`Notifications settings with user_id ${user_id} already exists`);
    }
    uns = new UserNotificationsSettings(user_id);
    // Organization
    uns.global_settings.new_member_organization = true;
    uns.global_settings.removed_member_in_organization = true;
    uns.global_settings.updated_role_in_organization = true;
    uns.global_settings.organization_removed = true;
    // Channel
    uns.global_settings.new_channel = true;
    uns.global_settings.new_member_channel = true;
    uns.global_settings.removed_member_in_channel = true;
    uns.global_settings.updated_role_in_channel = true;
    uns.global_settings.channel_removed = true;
    // Report
    uns.global_settings.new_report = true;
    uns.global_settings.new_report_version = true;
    uns.global_settings.report_removed = true;
    uns.global_settings.new_comment_in_report = true;
    uns.global_settings.replay_comment_in_report = true;
    uns.global_settings.new_mention_in_report = true;
    uns.global_settings.report_comment_removed = true;
    return this.provider.create(uns);
  }

  public async deleteByUserId(user_id: string): Promise<UserNotificationsSettings> {
    const uns: UserNotificationsSettings = await this.getUserNotificationsSettingsByUserId(user_id);
    if (!uns) {
      throw new NotFoundException(`User ${user_id} does not have notifications settings`);
    }
    await this.provider.deleteOne({ _id: this.provider.toObjectId(uns.id) });
    return uns;
  }

  public async updateUserNotificationsSettings(
    user_id: string,
    updateUserNotificationsSettings: UpdateUserNotificationsSettings | null,
    organization_id?: string,
    channel_id?: string,
  ): Promise<UserNotificationsSettings> {
    const uns: UserNotificationsSettings = await this.getUserNotificationsSettingsByUserId(user_id);
    if (!uns) {
      throw new NotFoundException(`User ${user_id} does not have notifications settings`);
    }
    switch (updateUserNotificationsSettings.scope) {
      case UserNotificationsSettingsScope.Global:
        return this.provider.update({ _id: this.provider.toObjectId(uns.id) }, { $set: { global_settings: updateUserNotificationsSettings.settings } });
      case UserNotificationsSettingsScope.Organization:
        const organization_settings: any = { ...uns.organization_settings };
        organization_settings[organization_id] = updateUserNotificationsSettings.settings;
        return this.provider.update({ _id: this.provider.toObjectId(uns.id) }, { $set: { organization_settings } });
      case UserNotificationsSettingsScope.Channel:
        const channels_settings: any = { ...uns.channels_settings };
        if (!channels_settings[organization_id]) {
          channels_settings[organization_id] = {};
        }
        channels_settings[organization_id][channel_id] = updateUserNotificationsSettings.settings;
        delete channels_settings[organization_id][channel_id].new_member_organization;
        delete channels_settings[organization_id][channel_id].removed_member_in_organization;
        delete channels_settings[organization_id][channel_id].updated_role_in_organization;
        delete channels_settings[organization_id][channel_id].organization_removed;
        delete channels_settings[organization_id][channel_id].new_channel;
        return this.provider.update({ _id: this.provider.toObjectId(uns.id) }, { $set: { channels_settings } });
      default:
        throw new BadRequestException('Invalid scope');
    }
  }

  public async deleteUserNotificationSettingsGivenScope(user_id: string, scope: UserNotificationsSettingsScope, organization_id?: string, channel_id?: string): Promise<UserNotificationsSettings> {
    const uns: UserNotificationsSettings = await this.getUserNotificationsSettingsByUserId(user_id);
    if (!uns) {
      throw new NotFoundException(`User ${user_id} does not have notifications settings`);
    }
    switch (scope) {
      case UserNotificationsSettingsScope.Global:
        return this.provider.update({ _id: this.provider.toObjectId(uns.id) }, { $set: { global_settings: new NotificationsSettings() } });
      case UserNotificationsSettingsScope.Organization:
        const organization_settings: any = { ...uns.organization_settings };
        delete organization_settings[organization_id];
        return this.provider.update({ _id: this.provider.toObjectId(uns.id) }, { $set: { organization_settings } });
      case UserNotificationsSettingsScope.Channel:
        const channels_settings: any = { ...uns.channels_settings };
        if (channels_settings[organization_id]) {
          delete channels_settings[organization_id][channel_id];
        }
        return this.provider.update({ _id: this.provider.toObjectId(uns.id) }, { $set: { channels_settings } });
      default:
        throw new BadRequestException('Invalid scope');
    }
  }
}
