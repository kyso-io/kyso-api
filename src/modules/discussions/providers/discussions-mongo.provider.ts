import { Discussion } from '@kyso-io/kyso-model';
import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../../main';
import { MongoProvider } from '../../../providers/mongo.provider';

@Injectable()
export class DiscussionsMongoProvider extends MongoProvider<Discussion> {
  version = 1;

  constructor() {
    super('Discussion', db, [
      {
        keys: {
          title: 'text',
          main: 'text',
          description: 'text',
        },
      },
    ]);
  }

  populateMinimalData() {
    Logger.log(`${this.baseCollection} has no minimal data to populate`);
  }
}
