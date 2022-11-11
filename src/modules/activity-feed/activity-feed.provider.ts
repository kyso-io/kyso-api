import { ActivityFeed } from '@kyso-io/kyso-model';
import { PartitionedCollectionMongoProvider } from '../../providers/partitioned-collection-mongo.provider';

export class ActivityFeedMongoProvider extends PartitionedCollectionMongoProvider<ActivityFeed> {
  version = 1;

  constructor(collectionName: string) {
    super(collectionName, []);
  }

  async initialMigration(): Promise<void> {
    await this.getCollection().updateMany(
      {},
      {
        $set: {
          always_show: false,
          user_ids: [],
        },
      },
    );
  }
}
