import { Injectable, Logger } from '@nestjs/common'
import { NotFoundError } from 'src/helpers/errorHandling'
import { MongoProvider } from 'src/providers/mongo.provider'
import { db } from 'src/main'

@Injectable()
export class FilesMongoProvider extends MongoProvider {
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
