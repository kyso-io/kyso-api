import {
    ActivityFeed,
    Comment,
    Discussion,
    EntityEnum,
    NormalizedResponseDTO,
    Organization,
    Relations,
    Report,
    ResourcePermissions,
    Tag,
    Team,
    TeamVisibilityEnum,
    Token,
    User,
} from '@kyso-io/kyso-model'
import { Controller, ForbiddenException, Get, NotFoundException, Param, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ObjectId } from 'mongodb'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Autowired } from '../../decorators/autowired'
import { GenericController } from '../../generic/controller.generic'
import { QueryParser } from '../../helpers/queryParser'
import { CurrentToken } from '../auth/annotations/current-token.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { CommentsService } from '../comments/comments.service'
import { DiscussionsService } from '../discussions/discussions.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { ReportsService } from '../reports/reports.service'
import { TagsService } from '../tags/tags.service'
import { TeamsService } from '../teams/teams.service'
import { UsersService } from '../users/users.service'
import { ActivityFeedService } from './activity-feed.service'

@ApiExtraModels(Report, NormalizedResponseDTO)
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('activity-feed')
@ApiTags('activity-feed')
export class ActivityFeedController extends GenericController<ActivityFeed> {
    @Autowired({ typeName: 'ActivityFeedService' })
    private activityFeedService: ActivityFeedService

    @Autowired({ typeName: 'OrganizationsService' })
    private organizationsService: OrganizationsService

    @Autowired({ typeName: 'TeamsService' })
    private teamsService: TeamsService

    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    @Autowired({ typeName: 'DiscussionsService' })
    private discussionsService: DiscussionsService

    @Autowired({ typeName: 'ReportsService' })
    private reportsService: ReportsService

    @Autowired({ typeName: 'TagsService' })
    private tagsService: TagsService

    @Autowired({ typeName: 'CommentsService' })
    private commentsService: CommentsService

    @Get('user')
    @ApiOperation({
        summary: `Search and fetch activity feed`,
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Activity feed matching criteria`,
        type: ActivityFeed,
        isArray: true,
    })
    async getUserActivityFeed(@CurrentToken() token: Token, @Req() req): Promise<NormalizedResponseDTO<ActivityFeed[]>> {
        const query: any = QueryParser.toQueryObject(req.url)
        if (!query.filter) {
            query.filter = {}
        }
        if (!query.sort) {
            query.sort = {
                created_at: -1,
            }
        }
        if (!query.filter.user_id) {
            query.filter.user_id = token.id
        } else if (query.filter.user_id !== token.id) {
            throw new ForbiddenException('You can only fetch activity feed for your own user')
        }
        const activityFeed: ActivityFeed[] = await this.activityFeedService.getActivityFeed(query)
        const relations: Relations = await this.getRelations(activityFeed)
        return new NormalizedResponseDTO(activityFeed, relations)
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
    async getOrganizationActivityFeed(
        @CurrentToken() token: Token,
        @Param('organizationName') organizationName: string,
        @Req() req,
    ): Promise<NormalizedResponseDTO<ActivityFeed[]>> {
        if (!token.isGlobalAdmin()) {
            const organizationResourcePermissions: ResourcePermissions = token.permissions.organizations.find(
                (resourcePermission: ResourcePermissions) => resourcePermission.name === organizationName,
            )
            if (!organizationResourcePermissions) {
                throw new ForbiddenException('You do not have permission to access this organization')
            }
        }
        const organization: Organization = await this.organizationsService.getOrganization({ filter: { sluglified_name: organizationName } })
        if (!organization) {
            throw new NotFoundException('Organization does not exist')
        }
        const query: any = QueryParser.toQueryObject(req.url)
        if (!query.filter) {
            query.filter = {}
        }
        query.filter.organization = organization.sluglified_name
        if (!query.sort) {
            query.sort = {
                created_at: -1,
            }
        }
        const activityFeed: ActivityFeed[] = await this.activityFeedService.getActivityFeed(query)
        const relations: Relations = await this.getRelations(activityFeed)
        return new NormalizedResponseDTO(activityFeed, relations)
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
    async getTeamActivityFeed(
        @CurrentToken() token: Token,
        @Param('organizationName') organizationName: string,
        @Param('teamName') teamName: string,
        @Req() req,
    ): Promise<NormalizedResponseDTO<ActivityFeed[]>> {
        const organization: Organization = await this.organizationsService.getOrganization({ filter: { sluglified_name: organizationName } })
        if (!organization) {
            throw new NotFoundException('Organization does not exist')
        }
        const team: Team = await this.teamsService.getTeam({ filter: { sluglified_name: teamName, organization_id: organization.id } })
        if (!team) {
            throw new NotFoundException('Team does not exist')
        }
        if (!token.isGlobalAdmin()) {
            if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
                const teamResourcePermissions: ResourcePermissions = token.permissions.teams.find(
                    (resourcePermission: ResourcePermissions) => resourcePermission.name === teamName,
                )
                if (!teamResourcePermissions) {
                    throw new ForbiddenException('You do not have permission to access this team')
                }
            }
        }
        const query: any = QueryParser.toQueryObject(req.url)
        if (!query.filter) {
            query.filter = {}
        }
        query.filter.organization = organization.sluglified_name
        query.filter.team = team.sluglified_name
        if (!query.sort) {
            query.sort = {
                created_at: -1,
            }
        }
        const activityFeed: ActivityFeed[] = await this.activityFeedService.getActivityFeed(query)
        const relations: Relations = await this.getRelations(activityFeed)
        return new NormalizedResponseDTO(activityFeed, relations)
    }

    private async getRelations(activityFeed: ActivityFeed[]): Promise<Relations> {
        const organizationSlugs: Map<string, string> = new Map<string, string>()
        const teamSlugs: Map<string, boolean> = new Map<string, boolean>()
        const reportIds: Map<string, boolean> = new Map<string, boolean>()
        const tagIds: Map<string, boolean> = new Map<string, boolean>()
        const userIds: Map<string, boolean> = new Map<string, boolean>()
        const discussionIds: Map<string, boolean> = new Map<string, boolean>()
        const commentsIds: Map<string, boolean> = new Map<string, boolean>()
        for (const activity of activityFeed) {
            if (activity?.organization) {
                organizationSlugs.set(activity.organization, null)
            }
            if (activity.team) {
                teamSlugs.set(`${activity.team}###${activity.organization}`, true)
            }
            if (activity.user_id) {
                userIds.set(activity.user_id, true)
            }
            if (activity.entity) {
                switch (activity.entity) {
                    case EntityEnum.REPORT:
                        reportIds.set(activity.entity_id, true)
                        break
                    case EntityEnum.DISCUSSION:
                        discussionIds.set(activity.entity_id, true)
                        break
                    case EntityEnum.TAG:
                        tagIds.set(activity.entity_id, true)
                        break
                    case EntityEnum.USER:
                        userIds.set(activity.entity_id, true)
                        break
                    case EntityEnum.COMMENT:
                        commentsIds.set(activity.entity_id, true)
                        break
                }
            }
        }
        const relations: Relations = {}
        let organizations: Organization[] = []
        relations.organization = {}
        if (organizationSlugs.size > 0) {
            organizations = await this.organizationsService.getOrganizations({ filter: { sluglified_name: { $in: Array.from(organizationSlugs.keys()) } } })
            organizations.forEach((organization: Organization) => {
                relations.organization[organization.id] = organization
                organizationSlugs.set(organization.sluglified_name, organization.id)
            })
        }
        let teams: Team[] = []
        relations.team = {}
        if (teamSlugs.size > 0) {
            const filter = []
            Array.from(teamSlugs.keys()).forEach((key: string) => {
                const [teamSlug, organizationSlug] = key.split('###')
                filter.push({ sluglified_name: teamSlug, organization_id: organizationSlugs.get(organizationSlug) })
            })
            teams = await this.teamsService.getTeams({ filter: { $or: filter } })
            teams.forEach((team: Team) => {
                relations.team[team.id] = team
            })
        }
        let comments: Comment[] = []
        relations.comment = {}
        if (commentsIds.size > 0) {
            comments = await this.commentsService.getComments({
                filter: { _id: { $in: Array.from(commentsIds.keys()).map((id: string) => new ObjectId(id)) } },
            })
            comments.forEach((comment: Comment) => {
                relations.comment[comment.id] = comment
                userIds.set(comment.user_id, true)
                if (comment.report_id) {
                    reportIds.set(comment.report_id, true)
                }
                if (comment.discussion_id) {
                    discussionIds.set(comment.discussion_id, true)
                }
            })
        }
        let reports: Report[] = []
        relations.report = {}
        if (reportIds.size > 0) {
            reports = await this.reportsService.getReports({ filter: { _id: { $in: Array.from(reportIds.keys()).map((id: string) => new ObjectId(id)) } } })
            reports.forEach((report: Report) => {
                relations.report[report.id] = report
            })
        }
        let discussions: Discussion[] = []
        relations.discussion = {}
        if (discussionIds.size > 0) {
            discussions = await this.discussionsService.getDiscussions({
                filter: { _id: { $in: Array.from(discussionIds.keys()).map((id: string) => new ObjectId(id)) } },
            })
            discussions.forEach((discussion: Discussion) => {
                relations.discussion[discussion.id] = discussion
            })
        }
        let tags: Tag[] = []
        relations.tag = {}
        if (tagIds.size > 0) {
            tags = await this.tagsService.getTags({ filter: { _id: { $in: Array.from(tagIds.keys()).map((id: string) => new ObjectId(id)) } } })
            tags.forEach((tag: Tag) => {
                relations.tag[tag.id] = tag
            })
        }
        let users: User[] = []
        relations.user = {}
        if (userIds.size > 0) {
            users = await this.usersService.getUsers({ filter: { _id: { $in: Array.from(userIds.keys()).map((id: string) => new ObjectId(id)) } } })
            users.forEach((user: User) => {
                relations.user[user.id] = user
            })
        }
        return relations
    }
}
