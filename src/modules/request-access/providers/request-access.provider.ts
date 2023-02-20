import { RequestAccess } from '@kyso-io/kyso-model';
import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../../main';
import { MongoProvider } from '../../../providers/mongo.provider';

@Injectable()
export class RequestAccessMongoProvider extends MongoProvider<RequestAccess> {
  version = 1;

  constructor() {
    super('RequestAccess', db, [
      {
        keys: {
          requester_user_id: 'text',
        },
      },
    ]);
  }

  populateMinimalData() {
    Logger.log(`${this.baseCollection} has no minimal data to populate`);
  }
}
