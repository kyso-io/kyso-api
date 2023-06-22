import { InlineComment, InlineCommentStatusEnum, InlineCommentStatusHistoryDto } from '@kyso-io/kyso-model';
import { Injectable, Logger } from '@nestjs/common';
import { Autowired } from '../../../decorators/autowired';
import { db } from '../../../main';
import { MongoProvider } from '../../../providers/mongo.provider';
import { ReportsService } from '../../reports/reports.service';

@Injectable()
export class MongoInlineCommentsProvider extends MongoProvider<InlineComment> {
  @Autowired({ typeName: 'ReportsService' })
  private reportsService: ReportsService;

  version = 6;

  constructor() {
    super('InlineComment', db, [
      {
        keys: {
          text: 'text',
        },
      },
    ]);
  }

  populateMinimalData() {
    Logger.log(`${this.baseCollection} has no minimal data to populate`);
  }

  /**
   * New properties
   *     - markAsDeleted: boolean
   *     - mentions: string[]
   *
   * This migration do:
   *     - Iterates through every document in InlineComments collection
   *     - For each of them:
   *         - Looks for property markAsDeleted and, if not exists, set it to false
   *         - Looks for property mentions and, if not existst, set it to []
   *
   */
  async migrate_from_1_to_2() {
    Logger.log('Migrating to InlineComments version 2');

    const cursor = await this.getCollection().find({});
    const allInlineComments: any[] = await cursor.toArray();

    for (const inlineComment of allInlineComments) {
      let markedAsDeleted;
      let mentions;

      if (!inlineComment.hasOwnProperty('markAsDeleted')) {
        markedAsDeleted = false;
      } else {
        markedAsDeleted = inlineComment.markedAsDeleted;
      }

      if (!inlineComment.hasOwnProperty('mentions')) {
        mentions = [];
      } else {
        mentions = inlineComment.mentions;
      }

      await this.update(
        { id: inlineComment.id },
        {
          $set: {
            mentions: mentions,
            markedAsDeleted: markedAsDeleted,
          },
        },
      );
    }
  }

  async migrate_from_2_to_3() {
    const cursor = await this.getCollection().find({});
    const allInlineComments: any[] = await cursor.toArray();
    for (const inlineComment of allInlineComments) {
      const report_version: number = await this.reportsService.getLastVersionOfReport(inlineComment.reportId);
      await this.update(
        { id: inlineComment.id },
        {
          $set: {
            parent_comment_id: null,
            report_version,
            current_status: InlineCommentStatusEnum.OPEN,
            status_history: [new InlineCommentStatusHistoryDto(new Date(), null, InlineCommentStatusEnum.OPEN, inlineComment.userId, report_version, false)],
            inline_comments: [],
          },
        },
      );
    }
  }

  async migrate_from_3_to_4() {
    await this.getCollection().updateMany({}, { $set: { file_id: null } });
  }

  /**
   * Included orphan property. By default, everyone is not orphan, we are not monsters!
   */
  async migrate_from_4_to_5() {
    await this.getCollection().updateMany({}, { $set: { orphan: false } });
  }

  async migrate_from_5_to_6() {
    const cursor = await this.getCollection().find({});
    const allInlineComments: any[] = await cursor.toArray();
    for (const inlineComment of allInlineComments) {
      const status_history: InlineCommentStatusHistoryDto[] = [...inlineComment.status_history] as InlineCommentStatusHistoryDto[];
      for (const sh of status_history) {
        sh.edited = false;
      }
      await this.update(
        { id: inlineComment.id },
        {
          $set: {
            status_history,
          },
        },
      );
    }
  }
}
