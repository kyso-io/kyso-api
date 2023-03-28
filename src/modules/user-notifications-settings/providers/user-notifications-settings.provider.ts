import { UserNotificationsSettings } from '@kyso-io/kyso-model';
import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../../main';
import { MongoProvider } from '../../../providers/mongo.provider';

@Injectable()
export class UserNotificationsSettingsProvider extends MongoProvider<UserNotificationsSettings> {
  version = 1;

  constructor() {
    super('UserNotificationsSettings', db, []);
  }

  populateMinimalData() {
    Logger.log(`${this.baseCollection} has no minimal data to populate`);
  }
}
