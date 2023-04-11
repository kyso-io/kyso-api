import { NotificationsSettings, UserNotificationsSettings } from '@kyso-io/kyso-model';
import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../../main';
import { MongoProvider } from '../../../providers/mongo.provider';

@Injectable()
export class UserNotificationsSettingsProvider extends MongoProvider<UserNotificationsSettings> {
  version = 2;

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
}
