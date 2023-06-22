import { Report } from '@kyso-io/kyso-model';
import { Injectable, Logger } from '@nestjs/common';
import { Autowired } from '../../../decorators/autowired';
import slug from '../../../helpers/slugify';
import { db } from '../../../main';
import { MongoProvider } from '../../../providers/mongo.provider';
import { FullTextSearchService } from '../../full-text-search/full-text-search.service';

@Injectable()
export class ReportsMongoProvider extends MongoProvider<Report> {
  @Autowired({ typeName: 'FullTextSearchService' })
  private fullTextSearchService: FullTextSearchService;

  version = 7;

  constructor() {
    super('Report', db, [
      {
        keys: {
          name: 'text',
          title: 'text',
          description: 'text',
        },
      },
    ]);
  }

  populateMinimalData() {
    Logger.log(`${this.baseCollection} has no minimal data to populate`);
  }

  /**
   * Refactored properties:
   *     - name to sluglified_name
   *
   * This migration do:
   *     - Iterates through every document in Reports collection
   *     - For each of them:
   *         - Read name property
   *         - Adds new sluglified_name property with name value, but sluglifing it
   *
   * This migration DOES NOT DELETE name property, to be backwards compatible, but these properties are deprecated and will be deleted in next migrations
   */
  async migrate_from_1_to_2(): Promise<void> {
    const cursor = await this.getCollection().find({});
    const allReports: any[] = await cursor.toArray();

    for (const report of allReports) {
      const data: any = {
        sluglified_name: slug(report.name),
      };

      await this.update(
        { _id: this.toObjectId(report.id) },
        {
          $set: data,
        },
      );
    }

    // This is made automatically, so don't need to add it explicitly
    // await this.saveModelVersion(2)
  }

  public async migrate_from_2_to_3(): Promise<void> {
    const cursor = await this.getCollection().find({});
    const allReports: any[] = await cursor.toArray();
    for (const report of allReports) {
      const data: any = {
        show_code: false,
        show_output: false,
      };
      await this.update(
        { _id: this.toObjectId(report.id) },
        {
          $set: data,
        },
      );
    }
  }

  public async migrate_from_3_to_4(): Promise<void> {
    const cursor = await this.getCollection().find({});
    const allReports: any[] = await cursor.toArray();
    for (const report of allReports) {
      const data: any = {
        main_file: null,
      };
      await this.update(
        { _id: this.toObjectId(report.id) },
        {
          $set: data,
        },
      );
    }
  }

  public async migrate_from_4_to_5() {
    await this.getCollection().updateMany({}, { $unset: { hook_id: '' } });
  }

  public async migrate_from_5_to_6() {
    await this.getCollection().updateMany({}, { $set: { toc: [] } });
  }

  public async migrate_from_6_to_7() {
    await this.fullTextSearchService.removeField('isPublic');
  }
}
