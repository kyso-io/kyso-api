import { KysoUserAccessToken, User } from '@kyso-io/kyso-model';
import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../main';
import { MongoProvider } from '../../../providers/mongo.provider';

@Injectable()
export class KysoUserAccessTokensMongoProvider extends MongoProvider<KysoUserAccessToken> {
  version = 1;

  provider: any;

  constructor() {
    super('KysoUserAccessToken', db);
  }

  async populateMinimalData() {
    Logger.log(`${this.baseCollection} has no minimal data to populate`);
  }
}
