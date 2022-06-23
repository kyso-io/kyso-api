import { Comment } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class CommentsMongoProvider extends MongoProvider<Comment> {
    version = 2
    provider: any

    constructor() {
        super('Comment', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }

    async getCommentsWithOwner(query) {
        const pipeline = []

        const { projection, ...rest } = MongoProvider.aggregationRename(query) as any

        if (projection) {
            projection.$project.user_id = 1
            pipeline.push(projection)
        }

        pipeline.push(
            ...Object.values(rest),
            ...MongoProvider.joinStage('user_id', 'User', 'user'),
            {
                $match: {
                    $or: [{ user: { $ne: [] } }],
                },
            },
            {
                $addFields: {
                    owner: {
                        $mergeObjects: [{ $arrayElemAt: ['$user', 0] }, { type: 'user' }],
                    },
                },
            },
            {
                $project: {
                    user: 0,
                    owner: { accessToken: 0 },
                },
            },
        )

        const comments = await this.aggregate(pipeline)
        return comments
    }

    async migrate_from_1_to_2(): Promise<void> {
        const comments: Comment[] = await this.read({})
        for (const comment of comments) {
            await this.update({ _id: this.toObjectId(comment.id) }, { $set: { plain_text: comment.text } })
        }
    }
}
