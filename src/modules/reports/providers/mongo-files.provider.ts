import { Injectable } from '@nestjs/common'
import { NotFoundError } from 'src/helpers/errorHandling'
import { MongoProvider } from 'src/providers/mongo.provider'

@Injectable()
export class FilesMongoProvider extends MongoProvider {
    constructor() {
        super('File')
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
