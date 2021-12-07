import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { GenericController } from 'src/generic/controller.generic'
import { ForbiddenError } from 'src/helpers/errorHandling'
import { HateoasLinker } from 'src/helpers/hateoasLinker'
import { Team } from 'src/model/team.model'
import { TeamsService } from 'src/modules/teams/teams.service'
import { Permission } from '../auth/annotations/permission.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { UpdateTeamRequest } from './model/update-team-request.model'
import { TeamPermissionsEnum } from './security/team-permissions.enum'

const UPDATABLE_FIELDS = ['email', 'nickname', 'bio', 'accessToken', 'access_token']

@ApiTags('teams')
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('teams')
export class TeamsController extends GenericController<Team> {
    constructor(private readonly teamsService: TeamsService) {
        super()
    }

    assignReferences(team: Team) {
        team.self_url = HateoasLinker.createRef(`/teams/${team.name}`)
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
    @ApiResponse({ status: 200, description: `Team matching name`, type: Team })
    @ApiHeader({
        name: 'x-kyso-team',
        description: 'Name of the team',
        required: true,
    })
    @Permission([TeamPermissionsEnum.READ])
    async getTeam(@Param('teamName') teamName: string) {
        const team = await this.teamsService.getTeam({
            filter: { name: teamName },
        })

        this.assignReferences(team)

        return team
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
    @ApiResponse({ status: 200, description: `Team matching name`, type: Team })
    @Permission([TeamPermissionsEnum.READ])
    async getTeamMembers(@Param('teamName') teamName: string) {
        return await this.teamsService.getMembers(teamName)
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
    @ApiResponse({
        status: 200,
        description: `Specified team data`,
        type: Team,
    })
    @Permission([TeamPermissionsEnum.EDIT])
    async updateTeam(@Body() data: UpdateTeamRequest, @Req() req, @Param('teamName') teamName: string) {
        // TODO: From where comes that req.user.objectId? Is a header? Is not in the documentation...
        if (!(await this.teamsService.hasPermissionLevel(req.user.objectId, teamName, 'editor'))) {
            throw new ForbiddenError({
                message: "You don't have permissions to edit this team.",
            })
        }

        const filterObj = { name: teamName }
        const fields = Object.fromEntries(Object.entries(data).filter((entry) => UPDATABLE_FIELDS.includes(entry[0])))

        const team = await (Object.keys(fields).length === 0
            ? this.teamsService.getTeam({ filter: filterObj })
            : this.teamsService.updateTeam(filterObj, { $set: fields }))

        return team
    }
}
