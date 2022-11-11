import { KysoDataModelVersion } from '@kyso-io/kyso-model';
import { Logger } from '@nestjs/common';
import { db } from '../main';
import { KYSO_MODEL_VERSION_COLLECTION_NAME } from './constants';

export abstract class PartitionedCollectionMongoProvider<T> {
  public abstract version: number;
  private collectionName: string;
  private indices: any[];

  constructor(collectionName: string, indices: any[]) {
    this.collectionName = collectionName;
    this.indices = indices;
  }

  protected abstract initialMigration(): Promise<void>;

  public getCollection() {
    return db.collection(this.collectionName);
  }

  private async existsMongoDBCollection(): Promise<boolean> {
    const allCollections: any[] = await db.listCollections().toArray();
    const found = allCollections.findIndex((item) => {
      return item.name === this.collectionName;
    });
    return found !== -1;
  }

  private async checkIndices(): Promise<void> {
    if (this.indices.length === 0) {
      return;
    }
    Logger.log(`Checking indexes for '${this.collectionName}' collection`, PartitionedCollectionMongoProvider.name);
    for (const element of this.indices) {
      try {
        await this.getCollection().createIndex(element.keys, element.options);
      } catch (e) {
        Logger.error(`Error checking indexes for '${this.collectionName}' collection`, e, PartitionedCollectionMongoProvider.name);
      }
    }
  }

  private async checkVersionCollection(): Promise<void> {
    const kysoDataModelVersion: KysoDataModelVersion[] = (await db
      .collection(KYSO_MODEL_VERSION_COLLECTION_NAME)
      .find({
        collection: this.collectionName,
      })
      .sort({ version: 1 })
      .toArray()) as any[];
    if (kysoDataModelVersion.length === 0) {
      await this.checkIndices();
      await this.initialMigration();
      const firstKysoDataModelVersion: KysoDataModelVersion = new KysoDataModelVersion();
      firstKysoDataModelVersion.collection = this.collectionName;
      firstKysoDataModelVersion.version = 1;
      firstKysoDataModelVersion.created_at = new Date();
      firstKysoDataModelVersion.updated_at = new Date();
      delete firstKysoDataModelVersion._id;
      await db.collection(KYSO_MODEL_VERSION_COLLECTION_NAME).insertOne(firstKysoDataModelVersion);
    } else {
      const currentKysoDataModelVersion: KysoDataModelVersion = kysoDataModelVersion[kysoDataModelVersion.length - 1];
      if (currentKysoDataModelVersion.version >= this.version) {
        return;
      }
      await this.checkIndices();
      for (let fromVersion = currentKysoDataModelVersion.version; fromVersion < this.version; fromVersion++) {
        const toVersion: number = fromVersion + 1;
        const method = `migrate_from_${fromVersion}_to_${toVersion}`;
        if (!this[method]) {
          continue;
        }
        await this[method]();
        await db.collection(KYSO_MODEL_VERSION_COLLECTION_NAME).updateOne(
          {
            _id: currentKysoDataModelVersion._id,
          },
          {
            $set: {
              version: toVersion,
              updated_at: new Date(),
            },
          },
        );
      }
    }
  }

  public async checkMigrations(): Promise<void> {
    const existsCollection: boolean = await this.existsMongoDBCollection();
    if (!existsCollection) {
      Logger.log(`Creating '${this.collectionName}' collection`, PartitionedCollectionMongoProvider.name);
      await db.createCollection(this.collectionName);
    }
    await this.checkVersionCollection();
  }
}
