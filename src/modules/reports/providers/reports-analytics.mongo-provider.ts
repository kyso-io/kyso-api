import { ReportAnalytics } from '@kyso-io/kyso-model';
import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../../main';
import { MongoProvider } from '../../../providers/mongo.provider';

@Injectable()
export class ReportsAnalyticsMongoProvider extends MongoProvider<ReportAnalytics> {
  version = 1;

  constructor() {
    super('ReportAnalytics', db);
  }

  populateMinimalData() {
    Logger.log(`${this.baseCollection} has no minimal data to populate`);
  }
}
