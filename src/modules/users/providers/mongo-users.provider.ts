import { Injectable } from '@nestjs/common';
import { MongoProvider } from 'src/providers/mongo.provider';

@Injectable()
export class UsersMongoProvider extends MongoProvider {
  provider: any;

  constructor() {
    super('_User');
  }

  async getUsersFromTeam(query, team) {
    const pipeline = [];
    const renamed = MongoProvider.aggregationRename(query);
    const {
      _p_viewers: viewers,
      _p_editors: editors,
      _p_admins: admins,
    } = team;

    pipeline.push(
      {
        $match: {
          $expr: {
            $or: [
              { $eq: ['$owningId', viewers] },
              { $eq: ['$owningId', editors] },
              { $eq: ['$owningId', admins] },
            ],
          },
        },
      },
      {
        $lookup: {
          from: '_User',
          localField: 'relatedId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      { $replaceRoot: { newRoot: '$user' } },
      ...Object.values(renamed),
    );

    const users = await this.aggregate(pipeline, '_Join:users:_Role');
    return users;
  }

  async getUsersWithSessionAndTeams(userId) {
    const pipeline = [
      { $match: { _id: userId } },
      {
        $addFields: {
          session: {
            $concat: ['_User$', '$_id'],
          },
        },
      },
      {
        $lookup: {
          from: '_Session',
          localField: 'session',
          foreignField: '_p_user',
          as: 'session',
        },
      },
      {
        $addFields: {
          session_token: {
            $let: {
              vars: {
                lastSession: { $arrayElemAt: ['$session', -1] },
              },
              in: '$$lastSession._session_token',
            },
          },
        },
      },
      {
        $lookup: {
          from: '_Join:users:_Role',
          localField: '_id',
          foreignField: 'relatedId',
          as: 'roles',
        },
      },
      {
        $lookup: {
          from: '_Role',
          localField: 'roles.owningId',
          foreignField: '_id',
          as: 'roles',
        },
      },
      {
        $addFields: {
          roles: {
            $map: {
              input: '$roles',
              as: 'each',
              in: {
                $mergeObjects: [
                  '$$each',
                  { roleId: { $concat: ['_Role$', '$$each._id'] } },
                ],
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: 'Team',
          let: { roleId: '$roles.roleId' },
          as: 'teams',
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $in: ['$_p_admins', '$$roleId'] },
                    { $in: ['$_p_editors', '$$roleId'] },
                    { $in: ['$_p_viewers', '$$roleId'] },
                  ],
                },
              },
            },
          ],
        },
      },
      { $project: { session: 0, roles: 0 } },
    ];

    const user = await this.aggregate(pipeline);
    return user;
  }
}
