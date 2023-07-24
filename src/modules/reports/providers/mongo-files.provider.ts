import { File, Report } from '@kyso-io/kyso-model';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Autowired } from '../../../decorators/autowired';
import { db } from '../../../main';
import { MongoProvider } from '../../../providers/mongo.provider';
import { ReportsService } from '../reports.service';

@Injectable()
export class FilesMongoProvider extends MongoProvider<File> {
  version = 8;

  @Autowired({ typeName: 'ReportsService' })
  private reportsService: ReportsService;

  constructor() {
    super('File', db);
  }

  populateMinimalData() {
    Logger.log(`${this.baseCollection} has no minimal data to populate`);
  }

  public async getFile(fileSha: string): Promise<File> {
    const files = await this.read({
      filter: { sha: fileSha },
      limit: 1,
    });
    if (files.length === 0) {
      throw new NotFoundException("The specified file couldn't be found");
    }
    return files[0];
  }

  public async getFileById(id: string): Promise<File> {
    const files: File[] = await this.read({ filter: { _id: this.toObjectId(id) } });
    return files.length === 1 ? files[0] : null;
  }

  public async migrate_from_1_to_2() {
    const cursor = await this.getCollection().find({});
    const files: File[] = await cursor.toArray();
    for (const file of files) {
      const data: any = {
        path_scs: null,
      };
      await this.update(
        { _id: this.toObjectId(file.id) },
        {
          $set: data,
        },
      );
    }
  }

  public async migrate_from_2_to_3() {
    await this.getCollection().updateMany({}, { $unset: { path_s3: '' } });
  }

  public async migrate_from_3_to_4() {
    this.db.collection('Version').drop((err, result) => {
      if (err) {
        Logger.error(err);
      } else {
        Logger.log(`Removed collection 'Version' from db: ${result}`, FilesMongoProvider.name);
      }
    });
  }

  public async migrate_from_4_to_5() {
    await this.getCollection().updateMany({}, { $set: { git_metadata: null } });
  }

  public async migrate_from_5_to_6() {
    await this.getCollection().updateMany({}, { $set: { toc: [] } });
  }

  public async migrate_from_6_to_7() {
    await this.getCollection().updateMany({}, { $set: { columns_stats: [] } });
  }

  public async migrate_from_7_to_8() {
    // Add new field to all documents
    await this.getCollection().updateMany({}, { $set: { is_main_file: false } });
    // Get all reports
    const reports: Report[] = await this.reportsService.getReports({});
    for (const report of reports) {
      // For each report get the last version of the report and set the main file
      const lastVersion: number = await this.reportsService.getLastVersionOfReport(report.id);
      const files: File[] = await this.read({
        filter: { report_id: report.id, version: lastVersion },
      });
      if (files.length === 1) {
        const file: File = files[0];
        Logger.log(`Setting main file to '${file.id} ${file.name}' for report '${report.id} ${report.sluglified_name}'`);
        await this.update(
          { _id: this.toObjectId(file.id) },
          {
            $set: { is_main_file: true },
          },
        );
      } else if (files.length > 1) {
        Logger.log(`More than one file found for report '${report.id} ${report.sluglified_name}'`);
        const file: File | undefined = files.find((f: File) => f.name === report.main_file);
        if (!file) {
          Logger.error(`No main file found for report '${report.id} ${report.sluglified_name}'`);
          continue;
        }
        Logger.log(`Setting main file to '${file.id} ${file.name}' for report '${report.id} ${report.sluglified_name}'`);
        await this.update(
          {
            _id: this.toObjectId(file.id),
          },
          {
            $set: { is_main_file: true },
          },
        );
      } else {
        Logger.error(`No files found for report '${report.id} ${report.sluglified_name}'`);
      }
    }
  }
}
