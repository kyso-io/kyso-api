import { NotificationsSettings, UserNotificationsSettings } from '@kyso-io/kyso-model';
import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../../main';
import { MongoProvider } from '../../../providers/mongo.provider';

@Injectable()
export class UserNotificationsSettingsProvider extends MongoProvider<UserNotificationsSettings> {
  version = 4;

  constructor() {
    super('UserNotificationsSettings', db, []);
  }

  populateMinimalData() {
    Logger.log(`${this.baseCollection} has no minimal data to populate`);
  }

  async migrate_from_1_to_2(): Promise<void> {
    const unss: UserNotificationsSettings[] = await this.getCollection().find({}).toArray();
    for (const uns of unss) {
      const channels_settings: {
        [organization_id: string]: {
          [channel_id: string]: NotificationsSettings;
        };
      } = { ...uns.channels_settings };
      for (const organization_id in channels_settings) {
        for (const channel_id in channels_settings[organization_id]) {
          channels_settings[organization_id][channel_id].new_member_organization = false;
          channels_settings[organization_id][channel_id].removed_member_in_organization = false;
          channels_settings[organization_id][channel_id].updated_role_in_organization = false;
          channels_settings[organization_id][channel_id].organization_removed = false;
          channels_settings[organization_id][channel_id].new_channel = false;
        }
      }
      await this.update(
        { _id: this.toObjectId(uns.id) },
        {
          $set: {
            channels_settings,
          },
        },
      );
    }
  }

  async migrate_from_2_to_3(): Promise<void> {
    const unss: UserNotificationsSettings[] = await this.getCollection().find({}).toArray();
    for (const uns of unss) {
      const channels_settings: {
        [organization_id: string]: {
          [channel_id: string]: NotificationsSettings;
        };
      } = { ...uns.channels_settings };
      for (const organization_id in channels_settings) {
        for (const channel_id in channels_settings[organization_id]) {
          delete channels_settings[organization_id][channel_id].new_member_organization;
          delete channels_settings[organization_id][channel_id].removed_member_in_organization;
          delete channels_settings[organization_id][channel_id].updated_role_in_organization;
          delete channels_settings[organization_id][channel_id].organization_removed;
          delete channels_settings[organization_id][channel_id].new_channel;
        }
      }
      await this.update(
        { _id: this.toObjectId(uns.id) },
        {
          $set: {
            channels_settings,
          },
        },
      );
    }
  }

  async migrate_from_3_to_4() {
    const cursor = await this.getCollection().find({});
    const unss: UserNotificationsSettings[] = await cursor.toArray();
    for (const uns of unss) {
      const global_settings: NotificationsSettings = { ...uns.global_settings } as any;
      global_settings.new_task = true;
      global_settings.new_task_reply = true;
      global_settings.task_status_changed = true;
      global_settings.task_updated = true;
      global_settings.task_reply_updated = true;
      global_settings.task_removed = true;
      global_settings.task_reply_removed = true;
      const organization_settings: { [organization_id: string]: NotificationsSettings } = { ...uns.organization_settings };
      for (const organizationId in organization_settings) {
        if (organization_settings.hasOwnProperty(organizationId)) {
          organization_settings[organizationId].new_task = true;
          organization_settings[organizationId].new_task_reply = true;
          organization_settings[organizationId].task_status_changed = true;
          organization_settings[organizationId].task_updated = true;
          organization_settings[organizationId].task_reply_updated = true;
          organization_settings[organizationId].task_removed = true;
          organization_settings[organizationId].task_reply_removed = true;
        }
      }
      const channels_settings: {
        [organization_id: string]: {
          [channel_id: string]: NotificationsSettings;
        };
      } = { ...uns.channels_settings };
      for (const organizationId in channels_settings) {
        if (channels_settings.hasOwnProperty(organizationId)) {
          for (const teamId in channels_settings[organizationId].teams) {
            if (channels_settings[organizationId].teams.hasOwnProperty(teamId)) {
              channels_settings[organizationId].teams[teamId].new_task = true;
              channels_settings[organizationId].teams[teamId].new_task_reply = true;
              channels_settings[organizationId].teams[teamId].task_status_changed = true;
              channels_settings[organizationId].teams[teamId].task_updated = true;
              channels_settings[organizationId].teams[teamId].task_reply_updated = true;
              channels_settings[organizationId].teams[teamId].task_removed = true;
              channels_settings[organizationId].teams[teamId].task_reply_removed = true;
            }
          }
        }
      }
      await this.getCollection().update(
        { id: uns.id },
        {
          $set: {
            global_settings,
            organization_settings,
            channels_settings,
          },
        },
      );
    }
  }
}
