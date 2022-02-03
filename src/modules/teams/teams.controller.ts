import {
    HEADER_X_KYSO_ORGANIZATION,
    HEADER_X_KYSO_TEAM,
    NormalizedResponseDTO,
    Report,
    Team,
    TeamMember,
    Token,
    UpdateTeamMembersDTO,
    UpdateTeamRequest,
} from '@kyso-io/kyso-model'
import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    PreconditionFailedException,
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiExtraModels, ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ObjectId } from 'mongodb'
import { diskStorage } from 'multer'
import { extname } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Autowired } from '../../decorators/autowired'
import { GenericController } from '../../generic/controller.generic'
import { CurrentToken } from '../auth/annotations/current-token.decorator'
import { Permission } from '../auth/annotations/permission.decorator'
import { AuthService } from '../auth/auth.service'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { TeamPermissionsEnum } from './security/team-permissions.enum'
import { TeamsService } from './teams.service'
import slugify from '../../helpers/slugify'

@ApiTags('teams')
@ApiExtraModels(Team)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('teams')
export class TeamsController extends GenericController<Team> {
    @Autowired({ typeName: 'AuthService' })
    private readonly authService: AuthService

    constructor(private readonly teamsService: TeamsService) {
        super()
    }

    assignReferences(team: Team) {
        // team.self_url = HateoasLinker.createRef(`/teams/${team.name}`)
    }

    @Get()
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
    async getVisibilityTeams(@Req() req): Promise<NormalizedResponseDTO<Team[]>> {
        const splittedToken = req.headers['authorization'].split('Bearer ')[1]

        const token: Token = this.authService.evaluateAndDecodeToken(splittedToken)

        const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id)
        return new NormalizedResponseDTO(teams)
    }

    @Get('/:id')
    @ApiOperation({
        summary: `Get a team`,
        description: `Allows fetching content of a specific team passing its id`,
    })
    @ApiParam({
        name: 'id',
        required: true,
        description: `Id of the team to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Team matching id`, type: Team })
    @Permission([TeamPermissionsEnum.READ])
    async getTeamById(@Param('id') id: string): Promise<NormalizedResponseDTO<Team>> {
        const team: Team = await this.teamsService.getTeamById(id)
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }
        this.assignReferences(team)
        return new NormalizedResponseDTO(team)
    }

    @Get('/check-name/:name')
    @ApiOperation({
        summary: `Check if team name is unique`,
        description: `Allows checking if a team name is unique`,
    })
    @ApiParam({
        name: 'name',
        required: true,
        description: `Name of the team to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Team matching name`, type: Boolean })
    @Permission([TeamPermissionsEnum.READ])
    public async checkIfTeamNameIsUnique(@Param('name') name: string): Promise<NormalizedResponseDTO<boolean>> {
        const team: Team = await this.teamsService.getTeam({ filter: { name: slugify(name) } })
        return new NormalizedResponseDTO<boolean>(team === null)
    }

    @Get('/:id/members')
    @ApiOperation({
        summary: `Get the member's team`,
        description: `Allows fetching content of a specific team passing its name`,
    })
    @ApiParam({
        name: 'id',
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
    async getTeamMembers(@Param('id') id: string): Promise<NormalizedResponseDTO<TeamMember[]>> {
        const data: TeamMember[] = await this.teamsService.getMembers(id)
        return new NormalizedResponseDTO(data)
    }

    @Get('/:teamId/members/:userId')
    @ApiOperation({
        summary: `Check if users belongs to a team`,
        description: `Allows fetching content of a specific team passing its id`,
    })
    @ApiParam({
        name: 'teamId',
        required: true,
        description: `Id of the team to fetch`,
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'userId',
        required: true,
        description: `Id of the user to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Team matching name`, type: Boolean })
    @ApiHeader({
        name: HEADER_X_KYSO_TEAM,
        description: 'Name of the team',
        required: true,
    })
    @Permission([TeamPermissionsEnum.READ])
    async getTeamMember(@Param('teamId') teamId: string, @Param('userId') userId: string): Promise<NormalizedResponseDTO<boolean>> {
        const team: Team = await this.teamsService.getTeamById(teamId)
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }
        const teamMember: TeamMember[] = await this.teamsService.getMembers(team.id)
        const belongs: boolean = teamMember.findIndex((member: TeamMember) => member.id === userId) !== -1
        return new NormalizedResponseDTO(belongs)
    }

    @Patch('/:teamId/members/:userId')
    @ApiOperation({
        summary: `Add a member to a team`,
        description: `Allows adding a member to a team passing its name and the user's name`,
    })
    @ApiParam({
        name: 'teamId',
        required: true,
        description: `Name of the team to fetch`,
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'userId',
        required: true,
        description: `User id of the user to add`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Team matching name`, type: TeamMember })
    @Permission([TeamPermissionsEnum.EDIT])
    async addMemberToTeam(@Param('teamId') teamId: string, @Param('userId') userId: string): Promise<NormalizedResponseDTO<TeamMember[]>> {
        const members: TeamMember[] = await this.teamsService.addMemberToTeam(teamId, userId)
        return new NormalizedResponseDTO(members)
    }

    @Delete('/:teamId/members/:userId')
    @ApiOperation({
        summary: `Remove a member from a team`,
        description: `Allows removing a member from a team passing its id and the user's id`,
    })
    @ApiParam({
        name: 'teamId',
        required: true,
        description: `Id of the team to fetch`,
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'userId',
        required: true,
        description: `Id of the user to remove`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Team matching name`, type: TeamMember })
    @Permission([TeamPermissionsEnum.EDIT])
    async removeMemberFromTeam(@Param('teamId') teamId: string, @Param('userId') userId: string): Promise<NormalizedResponseDTO<TeamMember[]>> {
        const members: TeamMember[] = await this.teamsService.removeMemberFromTeam(teamId, userId)
        return new NormalizedResponseDTO(members)
    }

    @Patch('/:teamId')
    @ApiOperation({
        summary: `Update the specified team`,
        description: `Allows updating content from the specified team`,
    })
    @ApiParam({
        name: 'teamId',
        required: true,
        description: `Id of the team to fetch`,
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
    async updateTeam(@Param('teamId') teamId: string, @Body() data: UpdateTeamRequest): Promise<NormalizedResponseDTO<Team>> {
        const team: Team = await this.teamsService.getTeamById(teamId)
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }
        const upadtedTeam: Team = await this.teamsService.updateTeam({ _id: new ObjectId(teamId) }, { $set: data })
        return new NormalizedResponseDTO(upadtedTeam)
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
    async createTeam(@CurrentToken() token: Token, @Body() team: Team): Promise<NormalizedResponseDTO<Team>> {
        const newTeam: Team = await this.teamsService.createTeam(team, token.id)
        return new NormalizedResponseDTO(newTeam)
    }

    @Get('/:teamId/reports')
    @ApiOperation({
        summary: `Get the reports of the specified team`,
        description: `Allows fetching content of a specific team passing its name`,
    })
    @ApiParam({
        name: 'teamId',
        required: true,
        description: `Id of the team to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Team reports`, type: Report })
    @ApiHeader({
        name: HEADER_X_KYSO_TEAM,
        description: 'Name of the team',
        required: true,
    })
    @Permission([TeamPermissionsEnum.READ])
    async getReportsOfTeam(@CurrentToken() token: Token, @Param('teamId') teamId: string): Promise<NormalizedResponseDTO<Report[]>> {
        const reports: Report[] = await this.teamsService.getReportsOfTeam(token, teamId)
        return new NormalizedResponseDTO(reports)
    }

    @Patch('/:teamId/members-roles')
    @ApiOperation({
        summary: `Add roles to members of a team`,
        description: `Allows adding a role to a member of a team passing its id`,
    })
    @ApiParam({
        name: 'teamId',
        required: true,
        description: `Id of the team to set user roles`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 201, description: `Updated organization`, type: TeamMember })
    @Permission([TeamPermissionsEnum.EDIT])
    public async UpdateTeamMembersDTORoles(@Param('teamId') teamId: string, @Body() data: UpdateTeamMembersDTO): Promise<NormalizedResponseDTO<TeamMember[]>> {
        const teamMembers: TeamMember[] = await this.teamsService.UpdateTeamMembersDTORoles(teamId, data)
        return new NormalizedResponseDTO(teamMembers)
    }

    @Delete('/:teamId/members-roles/:userId/:role')
    @ApiOperation({
        summary: `Remove a role from a member of a team`,
        description: `Allows removing a role from a member of a team passing its id and the user's id`,
    })
    @ApiParam({
        name: 'teamId',
        required: true,
        description: `Id of the team to fetch`,
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'userId',
        required: true,
        description: `Id of the user to remove`,
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'role',
        required: true,
        description: `Name of the role to remove`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Remove role of user in a team`, type: TeamMember, isArray: true })
    @Permission([TeamPermissionsEnum.EDIT])
    public async removeTeamMemberRole(
        @Param('teamId') teamId: string,
        @Param('userId') userId: string,
        @Param('role') role: string,
    ): Promise<NormalizedResponseDTO<TeamMember[]>> {
        const teamMembers: TeamMember[] = await this.teamsService.removeTeamMemberRole(teamId, userId, role)
        return new NormalizedResponseDTO(teamMembers)
    }

    @Get('/:teamId/members/:userId')
    @ApiOperation({
        summary: `Check if user belongs to a team`,
        description: `Allows checking if a user belongs to a team passing its team id and the user's id`,
    })
    @ApiParam({
        name: 'teamId',
        required: true,
        description: `Id of the team to fetch`,
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'userId',
        required: true,
        description: `Id of the user to check`,
        schema: { type: 'string' },
    })
    public async userBelongsToTeam(@Param('teamId') teamId: string, @Param('userId') userId: string): Promise<NormalizedResponseDTO<boolean>> {
        const belongs: boolean = await this.teamsService.userBelongsToTeam(teamId, userId)
        return new NormalizedResponseDTO(belongs)
    }

    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: './public/teams-profile-pictures',
                filename: (req, file, callback) => {
                    callback(null, `${uuidv4()}${extname(file.originalname)}`)
                },
            }),
            fileFilter: (req, file, callback) => {
                if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
                    return callback(new Error('Only image files are allowed!'), false)
                }
                callback(null, true)
            },
        }),
    )
    @Post('/:teamId/profile-picture')
    @ApiOperation({
        summary: `Upload a profile picture for a team`,
        description: `Allows uploading a profile picture for a team passing its id and image`,
    })
    @ApiParam({
        name: 'teamId',
        required: true,
        description: `Id of the team to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 201, description: `Updated team`, type: Team })
    @Permission([TeamPermissionsEnum.EDIT])
    // Commented type throwing an Namespace 'global.Express' has no exported member 'Multer' error
    public async setProfilePicture(@Param('teamId') teamId: string, @UploadedFile() file: any /*Express.Multer.File*/): Promise<NormalizedResponseDTO<Team>> {
        if (!file) {
            throw new BadRequestException(`Missing file`)
        }
        const team: Team = await this.teamsService.setProfilePicture(teamId, file)
        return new NormalizedResponseDTO(team)
    }

    @Delete('/:teamId/profile-picture')
    @ApiOperation({
        summary: `Delete a profile picture for a team`,
        description: `Allows deleting a profile picture for a team passing its id`,
    })
    @ApiParam({
        name: 'teamId',
        required: true,
        description: `Id of the team to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Updated organization`, type: Team })
    public async deleteBackgroundImage(@Param('teamId') teamId: string): Promise<NormalizedResponseDTO<Team>> {
        const team: Team = await this.teamsService.deleteProfilePicture(teamId)
        return new NormalizedResponseDTO(team)
    }

    @Delete('/:teamId')
    @ApiOperation({
        summary: `Delete a team`,
        description: `Allows deleting a team passing its id`,
    })
    @ApiParam({
        name: 'teamId',
        required: true,
        description: `Id of the team to delete`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Deleted team`, type: Team })
    @Permission([TeamPermissionsEnum.DELETE])
    public async deleteTeam(@Param('teamId') teamId: string): Promise<NormalizedResponseDTO<Team>> {
        const team: Team = await this.teamsService.deleteTeam(teamId)
        return new NormalizedResponseDTO(team)
    }
}
