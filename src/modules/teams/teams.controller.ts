import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Headers,
    Param,
    Patch,
    Post,
    PreconditionFailedException,
    Req,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Autowired } from '../../decorators/autowired'
import { GenericController } from '../../generic/controller.generic'
import { HEADER_X_KYSO_ORGANIZATION, HEADER_X_KYSO_TEAM } from '../../model/constants'
import { NormalizedResponse } from '../../model/dto/normalized-reponse.dto'
import { UpdateTeamMembers } from '../../model/dto/update-team-members'
import { Report } from '../../model/report.model'
import { TeamMember } from '../../model/team-member.model'
import { Team } from '../../model/team.model'
import { Token } from '../../model/token.model'
import { UpdateTeamRequest } from '../../model/update-team-request.model'
import { CurrentToken } from '../auth/annotations/current-token.decorator'
import { Permission } from '../auth/annotations/permission.decorator'
import { AuthService } from '../auth/auth.service'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { UsersService } from '../users/users.service'
import { TeamPermissionsEnum } from './security/team-permissions.enum'
import { TeamsService } from './teams.service'

const UPDATABLE_FIELDS = ['email', 'nickname', 'bio', 'accessToken', 'access_token', 'location', 'link']

@ApiTags('teams')
@ApiExtraModels(Team)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('teams')
export class TeamsController extends GenericController<Team> {
    @Autowired({ typeName: 'AuthService' })
    private readonly authService: AuthService

    @Autowired({ typeName: 'UsersService' })
    private readonly usersService: UsersService

    constructor(private readonly teamsService: TeamsService) {
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
        if (!xKysoTeamHeader) {
            throw new BadRequestException('Missing team header')
        }
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
    @ApiNormalizedResponse({ status: 200, description: `Team matching name`, type: TeamMember })
    @ApiHeader({
        name: HEADER_X_KYSO_TEAM,
        description: 'Name of the team',
        required: true,
    })
    @Permission([TeamPermissionsEnum.READ])
    async getTeamMembers(@Param('teamName') teamName: string, @Headers(HEADER_X_KYSO_TEAM) xKysoTeamHeader: string): Promise<NormalizedResponse> {
        if (xKysoTeamHeader.toLowerCase() !== teamName.toLowerCase()) {
            throw new UnauthorizedException('Team path param and team header are not equal. This incident will be reported')
        }

        const data = await this.teamsService.getMembers(teamName)
        return new NormalizedResponse(data)
    }

    @Patch('/:teamName/members/:userName')
    @ApiOperation({
        summary: `Add a member to a team`,
        description: `Allows adding a member to a team passing its name and the user's name`,
    })
    @ApiParam({
        name: 'teamName',
        required: true,
        description: `Name of the team to fetch`,
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'userName',
        required: true,
        description: `Name of the user to add`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Team matching name`, type: TeamMember })
    @Permission([TeamPermissionsEnum.EDIT])
    async addMemberToTeam(@Param('teamName') teamName: string, @Param('userName') userName: string): Promise<NormalizedResponse> {
        const members: TeamMember[] = await this.teamsService.addMemberToTeam(teamName, userName)
        return new NormalizedResponse(members)
    }

    @Delete(':teamName/members/:userName')
    @ApiOperation({
        summary: `Remove a member from a team`,
        description: `Allows removing a member from a team passing its name and the user's name`,
    })
    @ApiParam({
        name: 'teamName',
        required: true,
        description: `Name of the team to fetch`,
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'userName',
        required: true,
        description: `Name of the user to remove`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Team matching name`, type: TeamMember })
    @Permission([TeamPermissionsEnum.EDIT])
    async removeMemberFromTeam(@Param('teamName') teamName: string, @Param('userName') userName: string): Promise<NormalizedResponse> {
        const members: TeamMember[] = await this.teamsService.removeMemberFromTeam(teamName, userName)
        return new NormalizedResponse(members)
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
        if (!xKysoTeamHeader) {
            throw new BadRequestException('Missing team header')
        }
        if (xKysoTeamHeader.toLowerCase() !== teamName.toLowerCase()) {
            throw new UnauthorizedException('Team path param and team header are not equal. This incident will be reported')
        }

        const filterObj = { name: teamName }
        const fields = Object.fromEntries(Object.entries(data).filter((entry) => UPDATABLE_FIELDS.includes(entry[0])))

        let team: Team = await this.teamsService.getTeam({ filter: filterObj })
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }
        team = await this.teamsService.updateTeam(filterObj, { $set: fields })

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

    @Post(':teamName/members-roles')
    @ApiOperation({
        summary: `Add a role to a member of a team`,
        description: `Allows adding a role to a member of a team passing its name and the user's name`,
    })
    @ApiParam({
        name: 'teamName',
        required: true,
        description: `Name of the team to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 201, description: `Updated organization`, type: TeamMember })
    @Permission([TeamPermissionsEnum.EDIT])
    public async updateTeamMembersRoles(@Param('teamName') teamName: string, @Body() data: UpdateTeamMembers): Promise<NormalizedResponse> {
        const teamMembers: TeamMember[] = await this.teamsService.updateTeamMembersRoles(teamName, data)
        return new NormalizedResponse(teamMembers)
    }

    @Delete(':teamName/members-roles/:userName/:role')
    @ApiOperation({
        summary: `Remove a role from a member of a team`,
        description: `Allows removing a role from a member of a team passing its name and the user's name`,
    })
    @ApiParam({
        name: 'teamName',
        required: true,
        description: `Name of the team to fetch`,
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'userName',
        required: true,
        description: `Name of the user to remove`,
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'role',
        required: true,
        description: `Name of the role to remove`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Team matching name`, type: TeamMember })
    @Permission([TeamPermissionsEnum.EDIT])
    public async removeTeamMemberRole(
        @Param('teamName') teamName: string,
        @Param('userName') userName: string,
        @Param('role') role: string,
    ): Promise<NormalizedResponse> {
        const teamMembers: TeamMember[] = await this.teamsService.removeTeamMemberRole(teamName, userName, role)
        return new NormalizedResponse(teamMembers)
    }
}
