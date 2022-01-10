import { Body, Controller, Get, Headers, Param, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { GenericController } from '../../generic/controller.generic'
import { HEADER_X_KYSO_ORGANIZATION, HEADER_X_KYSO_TEAM } from '../../model/constants'
import { NormalizedResponse } from '../../model/dto/normalized-reponse.dto'
import { Report } from '../../model/report.model'
import { Team } from '../../model/team.model'
import { Token } from '../../model/token.model'
import { UpdateTeamRequest } from '../../model/update-team-request.model'
import { CurrentToken } from '../auth/annotations/current-token.decorator'
import { Permission } from '../auth/annotations/permission.decorator'
import { AuthService } from '../auth/auth.service'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { TeamPermissionsEnum } from './security/team-permissions.enum'
import { TeamsService } from './teams.service'

const UPDATABLE_FIELDS = ['email', 'nickname', 'bio', 'accessToken', 'access_token']

@ApiTags('teams')
@ApiExtraModels(Team)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('teams')
export class TeamsController extends GenericController<Team> {
    constructor(private readonly teamsService: TeamsService, private readonly authService: AuthService) {
        super()
    }

    assignReferences(team: Team) {
        // team.self_url = HateoasLinker.createRef(`/teams/${team.name}`)
    }

    @Get('/')
    @ApiOperation({
        summary: `Get all team's in which user has visibility`,
        description: `Allows fetching content of all the teams that the user has visibility`,
    })
    @ApiNormalizedResponse({ status: 200, description: `Team matching name`, type: Team })
    @ApiHeader({
        name: HEADER_X_KYSO_ORGANIZATION,
        description: 'Organization',
        required: true,
    })
    @Permission([TeamPermissionsEnum.READ])
    async getVisibilityTeams(@Req() req) {
        const splittedToken = req.headers['authorization'].split('Bearer ')[1]

        const token: Token = this.authService.evaluateAndDecodeToken(splittedToken)

        return new NormalizedResponse(await this.teamsService.getTeamsVisibleForUser(token.id))
    }

    @Get('/:teamName')
    @ApiOperation({
        summary: `Get a team`,
        description: `Allows fetching content of a specific team passing its name`,
    })
    @ApiParam({
        name: 'teamName',
        required: true,
        description: `Name of the team to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Team matching name`, type: Team })
    @ApiHeader({
        name: HEADER_X_KYSO_TEAM,
        description: 'Name of the team',
        required: true,
    })
    @Permission([TeamPermissionsEnum.READ])
    async getTeam(@Param('teamName') teamName: string, @Headers(HEADER_X_KYSO_TEAM) xKysoTeamHeader: string) {
        if (xKysoTeamHeader.toLowerCase() !== teamName.toLowerCase()) {
            throw new UnauthorizedException('Team path param and team header are not equal. This incident will be reported')
        }

        const team = await this.teamsService.getTeam({
            filter: { name: teamName },
        })

        this.assignReferences(team)

        return new NormalizedResponse(team)
    }

    @Get('/:teamName/members')
    @ApiOperation({
        summary: `Get the member's team`,
        description: `Allows fetching content of a specific team passing its name`,
    })
    @ApiParam({
        name: 'teamName',
        required: true,
        description: `Name of the team to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Team matching name`, type: Team })
    @ApiHeader({
        name: HEADER_X_KYSO_TEAM,
        description: 'Name of the team',
        required: true,
    })
    @Permission([TeamPermissionsEnum.READ])
    async getTeamMembers(@Param('teamName') teamName: string, @Headers(HEADER_X_KYSO_TEAM) xKysoTeamHeader: string) {
        if (xKysoTeamHeader.toLowerCase() !== teamName.toLowerCase()) {
            throw new UnauthorizedException('Team path param and team header are not equal. This incident will be reported')
        }

        const data = await this.teamsService.getMembers(teamName)
        return new NormalizedResponse(data)
    }

    @Patch('/:teamName')
    @ApiOperation({
        summary: `Update the specified team`,
        description: `Allows updating content from the specified team`,
    })
    @ApiParam({
        name: 'teamName',
        required: true,
        description: `Name of the team to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Specified team data`,
        type: Team,
    })
    @ApiHeader({
        name: HEADER_X_KYSO_TEAM,
        description: 'Name of the team',
        required: true,
    })
    @Permission([TeamPermissionsEnum.EDIT])
    async updateTeam(@Body() data: UpdateTeamRequest, @Req() req, @Param('teamName') teamName: string, @Headers(HEADER_X_KYSO_TEAM) xKysoTeamHeader: string) {
        if (xKysoTeamHeader.toLowerCase() !== teamName.toLowerCase()) {
            throw new UnauthorizedException('Team path param and team header are not equal. This incident will be reported')
        }

        const filterObj = { name: teamName }
        const fields = Object.fromEntries(Object.entries(data).filter((entry) => UPDATABLE_FIELDS.includes(entry[0])))

        const team = await (Object.keys(fields).length === 0
            ? this.teamsService.getTeam({ filter: filterObj })
            : this.teamsService.updateTeam(filterObj, { $set: fields }))

        return new NormalizedResponse(team)
    }

    @Post()
    @ApiOperation({
        summary: `Create a new team`,
        description: `Allows creating a new team`,
    })
    @ApiNormalizedResponse({
        status: 201,
        description: `Created team data`,
        type: Team,
    })
    @Permission([TeamPermissionsEnum.CREATE])
    async createTeam(@Body() team: Team): Promise<NormalizedResponse> {
        const teamDb: Team = await this.teamsService.createTeam(team)
        return new NormalizedResponse(teamDb)
    }

    @Get('/:teamName/reports')
    @ApiOperation({
        summary: `Get the reports of the specified team`,
        description: `Allows fetching content of a specific team passing its name`,
    })
    @ApiParam({
        name: 'teamName',
        required: true,
        description: `Name of the team to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Team matching name`, type: Report })
    @ApiHeader({
        name: HEADER_X_KYSO_TEAM,
        description: 'Name of the team',
        required: true,
    })
    @Permission([TeamPermissionsEnum.READ])
    async getReportsOfTeam(
        @CurrentToken() token: Token,
        @Param('teamName') teamName: string,
        @Headers(HEADER_X_KYSO_TEAM) xKysoTeamHeader: string,
    ): Promise<NormalizedResponse> {
        if (xKysoTeamHeader.toLowerCase() !== teamName.toLowerCase()) {
            throw new UnauthorizedException('Team path param and team header are not equal. This incident will be reported')
        }
        const reports: Report[] = await this.teamsService.getReportsOfTeam(token, teamName)
        return new NormalizedResponse(reports)
    }
}
