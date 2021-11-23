import { Injectable } from '@nestjs/common';
import { MongoProvider } from 'src/providers/mongo.provider';

@Injectable()
export class TeamsMongoProvider extends MongoProvider {
  rolesProvider: MongoProvider

  constructor() {
    super("Team")
    this.rolesProvider = new MongoProvider("_Role");
  }

  async getPermissionLevel(userId, teamName) {
    const pipeline = [
      { $match: { name: new RegExp(`^${teamName}-.+$`) } },
      { $project: { name: 1 } },
      { $lookup: {
        from: "_Join:users:_Role",
        let: { roleId: "$_id" },
        as: "match",
        pipeline: [{
          $match: { $expr: { $and: [
            { $eq: ["$owningId", "$$roleId"] },
            { $eq: ["$relatedId", userId] }
          ] } }
        }]
      } },
      { $unwind: { path: "$match", } }
    ]

    const permissions = await this.rolesProvider.aggregate(pipeline)
    return permissions.length === 0 ? "none" : permissions[0].name.match(`^${teamName}-(.*)s$`)[1]
  }
}
