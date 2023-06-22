import { ReportAnalytics } from '@kyso-io/kyso-model';
import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../../main';
import { MongoProvider } from '../../../providers/mongo.provider';

@Injectable()
export class ReportsAnalyticsMongoProvider extends MongoProvider<ReportAnalytics> {
  version = 2;

  constructor() {
    super('ReportAnalytics', db);
  }

  populateMinimalData() {
    Logger.log(`${this.baseCollection} has no minimal data to populate`);
  }

  async migrate_from_1_to_2(): Promise<void> {
    const reportsAnalytics: ReportAnalytics[] = await this.getCollection().find({}).toArray();
    for (const reportAnalytic of reportsAnalytics) {
      const data: any = {};
      if (!reportAnalytic.last_comments) {
        data.last_comments = [];
      }
      if (!reportAnalytic.last_tasks) {
        data.last_tasks = [];
      }
      await this.update(
        { _id: this.toObjectId(reportAnalytic.id) },
        {
          $set: data,
        },
      );
    }
  }
}
