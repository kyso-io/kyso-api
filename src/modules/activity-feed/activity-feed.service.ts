import { ActivityFeed } from '@kyso-io/kyso-model';
import { Injectable, Provider } from '@nestjs/common';
import * as moment from 'moment';
import { AutowiredService } from '../../generic/autowired.generic';
import { db } from '../../main';
import { ActivityFeedMongoProvider } from './activity-feed.provider';

function factory(service: ActivityFeedService) {
  return service;
}

export function createProvider(): Provider<ActivityFeedService> {
  return {
    provide: `${ActivityFeedService.name}`,
    useFactory: (service) => factory(service),
    inject: [ActivityFeedService],
  };
}

@Injectable()
export class ActivityFeedService extends AutowiredService {
  constructor() {
    super();
  }

  public async getActivityFeed(query: any): Promise<ActivityFeed[]> {
    let startDateMoment: moment.Moment;
    let endDateMoment: moment.Moment;
    if (query.filter?.created_at?.$gte) {
      startDateMoment = moment(query.filter.created_at.$gte);
    } else if (query.filter?.created_at?.$gt) {
      startDateMoment = moment(query.filter.created_at.$gt);
    } else {
      startDateMoment = moment();
    }
    if (query.filter?.created_at?.$lte) {
      endDateMoment = moment(query.filter.created_at.$lte);
    } else if (query.filter?.created_at?.$lt) {
      endDateMoment = moment(query.filter.created_at.$lt);
    } else {
      endDateMoment = moment();
    }
    const tables: string[] = [];
    for (const m = startDateMoment; m.isSameOrBefore(endDateMoment.endOf('month')); m.add(1, 'month')) {
      tables.push(`KysoActivityFeed-${m.year()}-${m.month() + 1}`);
    }
    if (query.sort.created_at === -1) {
      tables.reverse();
    }
    const promises: Promise<ActivityFeed[]>[] = [];
    for (const table of tables) {
      const activityFeedMongoProvider: ActivityFeedMongoProvider = new ActivityFeedMongoProvider(table);
      await activityFeedMongoProvider.checkMigrations();
      promises.push((activityFeedMongoProvider.getCollection().find(query.filter).sort(query.sort) as any).toArray());
    }
    const activityFeed: ActivityFeed[] = (await Promise.all(promises)).flat();
    return activityFeed;
  }

  public async deleteActivityFeed(filter: any): Promise<void> {
    const collections: any[] = await db.collections();
    const activityFeedCollections: any[] = collections.filter((collection) => collection.collectionName.startsWith('KysoActivityFeed'));
    for (const collection of activityFeedCollections) {
      await collection.deleteMany(filter);
    }
  }
}
