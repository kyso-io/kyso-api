import { File } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { NotFoundError } from '../../../helpers/errorHandling'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'
@Injectable()
export class FilesMongoProvider extends MongoProvider<File> {
    version = 2

    constructor() {
        super('File', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }

    public async getFile(fileSha: string): Promise<File> {
        const files = await this.read({
            filter: { sha: fileSha },
            limit: 1,
        })
        if (files.length === 0)
            throw new NotFoundError({
                message: "The specified file couldn't be found",
            })
        return files[0]
    }

    public async migrate_from_1_to_2() {
        const cursor = await this.getCollection().find({})
        const files: File[] = await cursor.toArray()
        for (let file of files) {
            const data: any = {
                path_scs: null,
            }
            await this.update(
                { _id: this.toObjectId(file.id) },
                {
                    $set: data,
                },
            )
        }
    }
}
