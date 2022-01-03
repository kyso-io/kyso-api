import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { Report } from '../../../model/report.model'
import { MongoProvider } from '../../../providers/mongo.provider'

@Injectable()
export class ReportsMongoProvider extends MongoProvider<Report> {
    constructor() {
        super('Report', db)
    }

    populateMinimalData() {
        Logger.log(`${this.baseCollection} has no minimal data to populate`)
    }

    async getReportsWithOwner(query) {
        const pipeline = []

        const { projection, ...rest } = MongoProvider.aggregationRename(query) as any

        if (projection) {
            projection.$project._p_user = 1
            projection.$project._p_team = 1
            pipeline.push(projection)
        }

        pipeline.push(
            ...Object.values(rest),
            ...MongoProvider.joinStage('_p_user', '_User', 'user'),
            ...MongoProvider.joinStage('_p_team', 'Team', 'team'),
            {
                $match: {
                    $or: [{ user: { $ne: [] } }, { team: { $ne: [] } }],
                },
            },
            {
                $addFields: {
                    owner: {
                        $cond: {
                            if: { $gt: ['$_p_team', null] },
                            then: {
                                $mergeObjects: [{ $arrayElemAt: ['$team', 0] }, { type: 'team' }],
                            },
                            else: {
                                $mergeObjects: [{ $arrayElemAt: ['$user', 0] }, { type: 'user' }],
                            },
                        },
                    },
                },
            },
            {
                $project: {
                    versionsArray: 0,
                    user: 0,
                    team: 0,
                    owner: { accessToken: 0 },
                },
            },
            {
                $addFields: {
                    full_name: {
                        $concat: [{ $ifNull: ['$owner.nickname', '$owner.name'] }, '/', '$name'],
                    },
                },
            },
        )

        const reports = await this.aggregate(pipeline)
        return reports
    }
}
