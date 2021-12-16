import { Injectable } from '@nestjs/common'
import { MongoProvider } from 'src/providers/mongo.provider'

@Injectable()
export class CommentsMongoProvider extends MongoProvider {
    provider: any

    constructor() {
        super('Comment')
    }

    async getCommentsWithOwner(query) {
        const pipeline = []

        const { projection, ...rest } = MongoProvider.aggregationRename(query) as any

        if (projection) {
            projection.$project._p_user = 1
            pipeline.push(projection)
        }

        pipeline.push(
            ...Object.values(rest),
            ...MongoProvider.joinStage('_p_user', '_User', 'user'),
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
}
