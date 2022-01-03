import { Injectable, Logger } from '@nestjs/common'
import { NotFoundError } from '../../../helpers/errorHandling'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'
@Injectable()
export class FilesMongoProvider extends MongoProvider<any> {
    constructor() {
        super('File', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }

    async getFile(fileSha) {
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
}
