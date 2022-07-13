import { ActivityFeed, NormalizedResponseDTO, Organization, Report, ResourcePermissions, Team, TeamVisibilityEnum, Token } from '@kyso-io/kyso-model'
import { Controller, ForbiddenException, Get, NotFoundException, Param, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Autowired } from '../../decorators/autowired'
import { GenericController } from '../../generic/controller.generic'
import { QueryParser } from '../../helpers/queryParser'
import { CurrentToken } from '../auth/annotations/current-token.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { OrganizationsService } from '../organizations/organizations.service'
import { TeamsService } from '../teams/teams.service'
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
        return new NormalizedResponseDTO(activityFeed)
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
        return new NormalizedResponseDTO(activityFeed)
    }

    @Get('oragnization/:organizationName/team/:teamName')
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
        return new NormalizedResponseDTO(activityFeed)
    }
}
