import {
  ActionEnum,
  ActivityFeed,
  Comment,
  Discussion,
  EntityEnum,
  InlineComment,
  NormalizedResponseDTO,
  Organization,
  Relations,
  Report,
  Tag,
  Team,
  TeamVisibilityEnum,
  Token,
  User,
} from '@kyso-io/kyso-model';
import { Controller, Get, NotFoundException, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ObjectId } from 'mongodb';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
import { Autowired } from '../../decorators/autowired';
import { Public } from '../../decorators/is-public';
import { GenericController } from '../../generic/controller.generic';
import { QueryParser } from '../../helpers/queryParser';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { CommentsService } from '../comments/comments.service';
import { DiscussionsService } from '../discussions/discussions.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { ReportsService } from '../reports/reports.service';
import { TagsService } from '../tags/tags.service';
import { TeamsService } from '../teams/teams.service';
import { UsersService } from '../users/users.service';
import { ActivityFeedService } from './activity-feed.service';
import { InlineCommentsService } from '../inline-comments/inline-comments.service';

@ApiExtraModels(Report, NormalizedResponseDTO)
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('activity-feed')
@ApiTags('activity-feed')
export class ActivityFeedController extends GenericController<ActivityFeed> {
  @Autowired({ typeName: 'ActivityFeedService' })
  private activityFeedService: ActivityFeedService;

  @Autowired({ typeName: 'OrganizationsService' })
  private organizationsService: OrganizationsService;

  @Autowired({ typeName: 'TeamsService' })
  private teamsService: TeamsService;

  @Autowired({ typeName: 'UsersService' })
  private usersService: UsersService;

  @Autowired({ typeName: 'DiscussionsService' })
  private discussionsService: DiscussionsService;

  @Autowired({ typeName: 'ReportsService' })
  private reportsService: ReportsService;

  @Autowired({ typeName: 'TagsService' })
  private tagsService: TagsService;

  @Autowired({ typeName: 'CommentsService' })
  private commentsService: CommentsService;

  @Autowired({ typeName: 'InlineCommentsService' })
  private inlineCommentsService: InlineCommentsService;

  @Get('user/:username')
  @ApiOperation({
    summary: `Search and fetch activity feed`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Activity feed matching criteria`,
    type: ActivityFeed,
    isArray: true,
  })
  @Public()
  async getUserActivityFeed(@CurrentToken() token: Token, @Param('username') username: string, @Req() req): Promise<NormalizedResponseDTO<ActivityFeed[]>> {
    const query: any = QueryParser.toQueryObject(req.url);
    if (!query.filter) {
      query.filter = {};
    }
    if (!query.sort) {
      query.sort = {
        created_at: -1,
      };
    }
    const mapOrgs: { [key: string]: Organization } = {};
    let whereCondition: any[] = [];
    const user: User = await this.usersService.getUser({
      filter: { username },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (token) {
      if (token.id === user.id) {
        query.filter = {
          created_at: query.filter.created_at,
          $or: [
            {
              user_id: token.id,
            },
            {
              user_ids: {
                $in: [token.id],
              },
            },
          ],
        };
        delete query.filter.user_id;
      } else {
        const desiredUserTeams: Team[] = await this.teamsService.getTeamsVisibleForUser(user.id);
        const userTeams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id);
        for (const team of desiredUserTeams) {
          if (!mapOrgs[team.organization_id]) {
            mapOrgs[team.organization_id] = await this.organizationsService.getOrganizationById(team.organization_id);
          }
          if (team.visibility === TeamVisibilityEnum.PUBLIC) {
            whereCondition.push({
              organization: mapOrgs[team.organization_id].sluglified_name,
              team: team.sluglified_name,
            });
          } else {
            const index: number = userTeams.findIndex((t: Team) => t.id === team.id);
            if (index !== -1) {
              whereCondition.push({
                organization: mapOrgs[team.organization_id].sluglified_name,
                team: team.sluglified_name,
              });
            }
          }
        }
        if (query.filter.team) {
          if (query.filter.team.$in) {
            whereCondition = whereCondition.filter((condition: { organization: string; team: string }) => {
              return query.filter.team.$in.indexOf(condition.team) !== -1;
            });
          } else {
            whereCondition = whereCondition.filter((condition: { organization: string; team: string }) => {
              return query.filter.team === condition.team;
            });
            if (whereCondition.length === 0) {
              const activityFeed: ActivityFeed[] = [];
              return new NormalizedResponseDTO(activityFeed);
            }
          }
          delete query.filter.team;
        }
        query.filter.$or = whereCondition;
      }
    } else {
      const desiredUserTeams: Team[] = await this.teamsService.getTeamsVisibleForUser(user.id);
      for (const team of desiredUserTeams) {
        if (team.visibility === TeamVisibilityEnum.PUBLIC) {
          if (!mapOrgs[team.organization_id]) {
            mapOrgs[team.organization_id] = await this.organizationsService.getOrganizationById(team.organization_id);
          }
          whereCondition.push({
            organization: mapOrgs[team.organization_id].sluglified_name,
            team: team.sluglified_name,
          });
        }
      }
      if (query.filter.team) {
        if (query.filter.team.$in) {
          whereCondition = whereCondition.filter((condition: { organization: string; team: string }) => {
            return query.filter.team.$in.indexOf(condition.team) !== -1;
          });
        } else {
          whereCondition = whereCondition.filter((condition: { organization: string; team: string }) => {
            return query.filter.team === condition.team;
          });
          if (whereCondition.length === 0) {
            const activityFeed: ActivityFeed[] = [];
            return new NormalizedResponseDTO(activityFeed);
          }
        }
        delete query.filter.team;
      }
      // Show create organization activity
      whereCondition.push({
        action: ActionEnum.CREATE,
        organization: {
          $ne: null,
        },
        team: null,
      });
      query.filter.$or = whereCondition;
    }
    const activityFeed: ActivityFeed[] = await this.activityFeedService.getActivityFeed(query);
    const relations: Relations = await this.getRelations(activityFeed);
    return new NormalizedResponseDTO(activityFeed, relations);
  }

  @Get('organization/:organizationName')
  @ApiOperation({
    summary: `Search and fetch activity feed for an organization`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Activity feed matching criteria`,
    type: ActivityFeed,
    isArray: true,
  })
  @Public()
  async getOrganizationActivityFeed(@CurrentToken() token: Token, @Param('organizationName') organizationName: string, @Req() req): Promise<NormalizedResponseDTO<ActivityFeed[]>> {
    const organization: Organization = await this.organizationsService.getOrganization({ filter: { sluglified_name: organizationName } });
    if (!organization) {
      throw new NotFoundException('Organization does not exist');
    }
    const query: any = QueryParser.toQueryObject(req.url);
    if (!query.filter) {
      query.filter = {};
    }
    if (!query.sort) {
      query.sort = {
        created_at: -1,
      };
    }
    let whereCondition: { organization: string; team: string }[] = [];
    if (token) {
      const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id);
      for (const team of teams) {
        if (team.organization_id === organization.id) {
          whereCondition.push({
            organization: organization.sluglified_name,
            team: team.sluglified_name,
          });
        }
      }
    } else {
      const teams: Team[] = await this.teamsService.getTeams({
        filter: {
          organization_id: organization.id,
          visibility: TeamVisibilityEnum.PUBLIC,
        },
      });
      for (const team of teams) {
        whereCondition.push({
          organization: organization.sluglified_name,
          team: team.sluglified_name,
        });
      }
    }
    if (whereCondition.length === 0) {
      const activityFeed: ActivityFeed[] = [];
      return new NormalizedResponseDTO(activityFeed);
    }
    if (query.filter.team) {
      if (query.filter.team.$in) {
        whereCondition = whereCondition.filter((condition: { organization: string; team: string }) => {
          return query.filter.team.$in.indexOf(condition.team) !== -1;
        });
      } else {
        whereCondition = whereCondition.filter((condition: { organization: string; team: string }) => {
          return query.filter.team === condition.team;
        });
        if (whereCondition.length === 0) {
          const activityFeed: ActivityFeed[] = [];
          return new NormalizedResponseDTO(activityFeed);
        }
      }
      delete query.filter.team;
    }
    whereCondition.push({
      organization: organization.sluglified_name,
      team: null,
    });
    query.filter.$or = whereCondition;
    const activityFeed: ActivityFeed[] = await this.activityFeedService.getActivityFeed(query);
    const relations: Relations = await this.getRelations(activityFeed);
    return new NormalizedResponseDTO(activityFeed, relations);
  }

  @Get('organization/:organizationName/team/:teamName')
  @ApiOperation({
    summary: `Search and fetch activity feed for a team`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Activity feed matching criteria`,
    type: ActivityFeed,
    isArray: true,
  })
  @Public()
  async getTeamActivityFeed(
    @CurrentToken() token: Token,
    @Param('organizationName') organizationName: string,
    @Param('teamName') teamName: string,
    @Req() req,
  ): Promise<NormalizedResponseDTO<ActivityFeed[]>> {
    const organization: Organization = await this.organizationsService.getOrganization({ filter: { sluglified_name: organizationName } });
    if (!organization) {
      throw new NotFoundException('Organization does not exist');
    }
    const team: Team = await this.teamsService.getTeam({ filter: { sluglified_name: teamName, organization_id: organization.id } });
    if (!team) {
      throw new NotFoundException('Team does not exist');
    }
    const query: any = QueryParser.toQueryObject(req.url);
    if (!query.filter) {
      query.filter = {};
    }
    if (!query.sort) {
      query.sort = {
        created_at: -1,
      };
    }
    query.filter.organization = organization.sluglified_name;
    query.filter.team = team.sluglified_name;
    if (token) {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id);
        const index: number = teams.findIndex((t: Team) => t.id === team.id);
        if (index === -1) {
          const activityFeed: ActivityFeed[] = [];
          return new NormalizedResponseDTO(activityFeed);
        }
      }
    } else {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        const activityFeed: ActivityFeed[] = [];
        return new NormalizedResponseDTO(activityFeed);
      }
    }
    const activityFeed: ActivityFeed[] = await this.activityFeedService.getActivityFeed(query);
    const relations: Relations = await this.getRelations(activityFeed);
    return new NormalizedResponseDTO(activityFeed, relations);
  }

  private async getRelations(activityFeed: ActivityFeed[]): Promise<Relations> {
    const organizationSlugs: Map<string, string> = new Map<string, string>();
    const teamSlugs: Map<string, boolean> = new Map<string, boolean>();
    const reportIds: Map<string, boolean> = new Map<string, boolean>();
    const tagIds: Map<string, boolean> = new Map<string, boolean>();
    const userIds: Map<string, boolean> = new Map<string, boolean>();
    const discussionIds: Map<string, boolean> = new Map<string, boolean>();
    const commentsIds: Map<string, boolean> = new Map<string, boolean>();
    const inlineCommentsIds: Map<string, boolean> = new Map<string, boolean>();
    for (const activity of activityFeed) {
      if (activity?.organization) {
        organizationSlugs.set(activity.organization, null);
      }
      if (activity.team) {
        teamSlugs.set(`${activity.team}###${activity.organization}`, true);
      }
      if (activity.user_id) {
        userIds.set(activity.user_id, true);
      }
      if (activity.entity) {
        switch (activity.entity) {
          case EntityEnum.REPORT:
            reportIds.set(activity.entity_id, true);
            break;
          case EntityEnum.DISCUSSION:
            discussionIds.set(activity.entity_id, true);
            break;
          case EntityEnum.TAG:
            tagIds.set(activity.entity_id, true);
            break;
          case EntityEnum.USER:
            userIds.set(activity.entity_id, true);
            break;
          case EntityEnum.COMMENT:
            commentsIds.set(activity.entity_id, true);
            break;
          case EntityEnum.INLINE_COMMENT:
            inlineCommentsIds.set(activity.entity_id, true);
            break;
        }
      }
    }
    const relations: Relations = {};
    let organizations: Organization[] = [];
    relations.organization = {};
    if (organizationSlugs.size > 0) {
      organizations = await this.organizationsService.getOrganizations({ filter: { sluglified_name: { $in: Array.from(organizationSlugs.keys()) } } });
      organizations.forEach((organization: Organization) => {
        relations.organization[organization.id] = organization;
        organizationSlugs.set(organization.sluglified_name, organization.id);
      });
    }
    let teams: Team[] = [];
    relations.team = {};
    if (teamSlugs.size > 0) {
      const filter = [];
      Array.from(teamSlugs.keys()).forEach((key: string) => {
        const [teamSlug, organizationSlug] = key.split('###');
        filter.push({ sluglified_name: teamSlug, organization_id: organizationSlugs.get(organizationSlug) });
      });
      teams = await this.teamsService.getTeams({ filter: { $or: filter } });
      teams.forEach((team: Team) => {
        relations.team[team.id] = team;
      });
    }
    let comments: Comment[] = [];
    relations.comment = {};
    if (commentsIds.size > 0) {
      comments = await this.commentsService.getComments({
        filter: { _id: { $in: Array.from(commentsIds.keys()).map((id: string) => new ObjectId(id)) } },
      });
      comments.forEach((comment: Comment) => {
        relations.comment[comment.id] = comment;
        userIds.set(comment.user_id, true);
        if (comment.report_id) {
          reportIds.set(comment.report_id, true);
        }
        if (comment.discussion_id) {
          discussionIds.set(comment.discussion_id, true);
        }
      });
    }
    let inlineComments: InlineComment[] = [];
    relations.inlineComment = {};
    if (inlineCommentsIds.size > 0) {
      inlineComments = await this.inlineCommentsService.getInlineComments({
        filter: { _id: { $in: Array.from(inlineCommentsIds.keys()).map((id: string) => new ObjectId(id)) } },
      });
      inlineComments.forEach((inlineComment: InlineComment) => {
        relations.inlineComment[inlineComment.id] = inlineComment;
        userIds.set(inlineComment.user_id, true);
        if (inlineComment.report_id) {
          reportIds.set(inlineComment.report_id, true);
        }
      });
    }
    let reports: Report[] = [];
    relations.report = {};
    if (reportIds.size > 0) {
      reports = await this.reportsService.getReports({ filter: { _id: { $in: Array.from(reportIds.keys()).map((id: string) => new ObjectId(id)) } } });
      reports.forEach((report: Report) => {
        relations.report[report.id] = report;
      });
    }
    let discussions: Discussion[] = [];
    relations.discussion = {};
    if (discussionIds.size > 0) {
      discussions = await this.discussionsService.getDiscussions({
        filter: { _id: { $in: Array.from(discussionIds.keys()).map((id: string) => new ObjectId(id)) } },
      });
      discussions.forEach((discussion: Discussion) => {
        relations.discussion[discussion.id] = discussion;
      });
    }
    let tags: Tag[] = [];
    relations.tag = {};
    if (tagIds.size > 0) {
      tags = await this.tagsService.getTags({ filter: { _id: { $in: Array.from(tagIds.keys()).map((id: string) => new ObjectId(id)) } } });
      tags.forEach((tag: Tag) => {
        relations.tag[tag.id] = tag;
      });
    }
    let users: User[] = [];
    relations.user = {};
    if (userIds.size > 0) {
      users = await this.usersService.getUsers({ filter: { _id: { $in: Array.from(userIds.keys()).map((id: string) => new ObjectId(id)) } } });
      users.forEach((user: User) => {
        relations.user[user.id] = user;
      });
    }
    return relations;
  }
}
