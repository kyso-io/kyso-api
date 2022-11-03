import { File } from '@kyso-io/kyso-model';
import { Injectable, Logger } from '@nestjs/common';
import { NotFoundError } from '../../../helpers/errorHandling';
import { db } from '../../../main';
import { MongoProvider } from '../../../providers/mongo.provider';
@Injectable()
export class FilesMongoProvider extends MongoProvider<File> {
  version = 5;

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
    if (files.length === 0)
      throw new NotFoundError({
        message: "The specified file couldn't be found",
      });
    return files[0];
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
}
