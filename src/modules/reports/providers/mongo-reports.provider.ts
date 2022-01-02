import { Injectable, Logger } from '@nestjs/common'
import { MongoProvider } from 'src/providers/mongo.provider'
import { db } from 'src/main'
import { Report } from 'src/model/report.model'

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
            projection.$project.user_id = 1
            projection.$project.team_id = 1
            pipeline.push(projection)
        }

        pipeline.push(
            ...Object.values(rest),

            // this is fucking me up
            // ...MongoProvider.joinStage('user_id', 'User', 'user'),
            // ...MongoProvider.joinStage('team_id', 'Team', 'team'),
            // {
            //     $match: {
            //         $or: [{ user: { $ne: [] } }, { team: { $ne: [] } }],
            //     },
            // },
            // {
            //     $addFields: {
            //         owner: {
            //             $cond: {
            //                 if: { $gt: ['$team_id', null] },
            //                 then: {
            //                     $mergeObjects: [{ $arrayElemAt: ['$team', 0] }, { type: 'team' }],
            //                 },
            //                 else: {
            //                     $mergeObjects: [{ $arrayElemAt: ['$user', 0] }, { type: 'user' }],
            //                 },
            //             },
            //         },
            //     },
            // },
            // {
            //     $project: {
            //         versionsArray: 0,
            //         user: 0,
            //         team: 0,
            //         owner: { accessToken: 0 },
            //     },
            // },
            // {
            //     $addFields: {
            //         full_name: {
            //             $concat: [{ $ifNull: ['$owner.nickname', '$owner.name'] }, '/', '$name'],
            //         },
            //     },
            // },
        )

        // console.log(JSON.stringify(pipeline, null, 2))
        const reports = await this.aggregate(pipeline)
        return reports
    }
}
