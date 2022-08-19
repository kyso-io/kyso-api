import {
    HEADER_X_KYSO_ORGANIZATION,
    HEADER_X_KYSO_TEAM,
    NormalizedResponseDTO,
    Report,
    ResourcePermissions,
    Team,
    TeamInfoDto,
    TeamMember,
    TeamPermissionsEnum,
    TeamVisibilityEnum,
    Token,
    UpdateTeamMembersDTO,
    UpdateTeamRequest,
} from '@kyso-io/kyso-model'
import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    Logger,
    NotFoundException,
    Param,
    Patch,
    Post,
    PreconditionFailedException,
    Query,
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiExtraModels, ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ObjectId } from 'mongodb'
import { PlatformRole } from 'src/security/platform-roles'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Autowired } from '../../decorators/autowired'
import { Public } from '../../decorators/is-public'
import { GenericController } from '../../generic/controller.generic'
import { QueryParser } from '../../helpers/queryParser'
import slugify from '../../helpers/slugify'
import { CurrentToken } from '../auth/annotations/current-token.decorator'
import { Permission } from '../auth/annotations/permission.decorator'
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { SolvedCaptchaGuard } from '../auth/guards/solved-captcha.guard'
import { RelationsService } from '../relations/relations.service'
import { TeamsService } from './teams.service'

@ApiTags('teams')
@ApiExtraModels(Team)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('teams')
@ApiHeader({
    name: HEADER_X_KYSO_ORGANIZATION,
    description: 'active organization (i.e: lightside)',
    required: true,
})
@ApiHeader({
    name: HEADER_X_KYSO_TEAM,
    description: 'active team (i.e: protected-team)',
    required: true,
})
export class TeamsController extends GenericController<Team> {
    @Autowired({ typeName: 'RelationsService' })
    private relationsService: RelationsService

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
    // @Permission([TeamPermissionsEnum.READ])
    async getVisibilityTeams(@CurrentToken() token: Token, @Req() req): Promise<NormalizedResponseDTO<Team[]>> {
        const query = QueryParser.toQueryObject(req.url)
        if (!query.sort) {
            query.sort = { created_at: -1 }
        }
        if (!query.filter) {
            query.filter = {}
        }
        let userId: string = token.id
        if (query.filter?.user_id && query.filter.user_id.length > 0) {
            userId = query.filter.user_id
            delete query.filter.user_id
        }
        const teams: Team[] = await this.teamsService.getTeamsForController(userId, query)
        return new NormalizedResponseDTO(teams)
    }

    @Get('/info')
    @ApiOperation({
        summary: `Get the number of members, reports, discussions and comments by team`,
        description: `Allows fetching the number of members, reports, discussions and comments by team`,
    })
    @ApiNormalizedResponse({ status: 200, description: `Number of members and reports by team`, type: TeamInfoDto })
    public async getNumMembersAndReportsByOrganization(
        @CurrentToken() token: Token,
        @Query('teamId') teamId: string,
    ): Promise<NormalizedResponseDTO<TeamInfoDto[]>> {
        const organizationInfoDto: TeamInfoDto[] = await this.teamsService.getTeamsInfo(token, teamId)
        const relations = await this.relationsService.getRelations(organizationInfoDto)
        return new NormalizedResponseDTO(organizationInfoDto, relations)
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
    @Public()
    async getTeamById(@CurrentToken() token: Token, @Param('id') id: string): Promise<NormalizedResponseDTO<Team>> {
        const team: Team = await this.teamsService.getTeamById(id)
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }
        if (token) {
            const index: number = token.permissions.teams.findIndex((teamResourcePermission: ResourcePermissions) => teamResourcePermission.id === id)
            if (index === -1) {
                if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
                    throw new ForbiddenException('You are not allowed to access this team')
                }
            }
        } else {
            if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
                throw new ForbiddenException('You are not allowed to access this team')
            }
        }
        delete team.roles
        delete team.slackChannel
        return new NormalizedResponseDTO(team)
    }

    @Get('/check-name/:organizationId/:name')
    @ApiOperation({
        summary: `Check if team name is unique`,
        description: `Allows checking if a team name is unique`,
    })
    @ApiParam({
        name: 'organizationId',
        required: true,
        description: `Id of the organization that the team belongs to`,
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'name',
        required: true,
        description: `Name of the team to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Returns true if name is available`, type: Boolean })
    @Permission([TeamPermissionsEnum.READ])
    public async checkIfTeamNameIsUnique(
        @Param('name') name: string,
        @Param('organizationId') organizationId: string,
    ): Promise<NormalizedResponseDTO<boolean>> {
        if (!name || name.length === 0) {
            throw new BadRequestException('Team name is required')
        }
        if (!organizationId || organizationId.length === 0) {
            throw new BadRequestException('Organization id is required')
        }
        const team: Team = await this.teamsService.getUniqueTeam(organizationId, slugify(name))
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
        description: `Id of the team to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Team matching name`, type: TeamMember })
    @ApiHeader({
        name: HEADER_X_KYSO_TEAM,
        description: 'Name of the team',
        required: true,
    })
    @Public()
    async getTeamMembers(@CurrentToken() token: Token, @Param('id') id: string): Promise<NormalizedResponseDTO<TeamMember[]>> {
        const team: Team = await this.teamsService.getTeamById(id)
        if (!team) {
            throw new NotFoundException('Team not found')
        }
        if (!token) {
            if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
                throw new ForbiddenException('You are not allowed to access this team')
            }
        }
        const data: TeamMember[] = await this.teamsService.getMembers(id)
        return new NormalizedResponseDTO(data)
    }

    @Get('/:teamId/assignees')
    @ApiOperation({
        summary: `Get assignee list`,
        description: `Allows fetching content of a specific team passing its name`,
    })
    @ApiParam({
        name: 'teamId',
        required: true,
        description: `Id of the team to fetch assignees`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Team matching name`, type: TeamMember })
    @ApiHeader({
        name: HEADER_X_KYSO_TEAM,
        description: 'Name of the team',
        required: true,
    })
    @Public()
    async getAssignees(@CurrentToken() token: Token, @Param('teamId') teamId: string): Promise<NormalizedResponseDTO<TeamMember[]>> {
        const team: Team = await this.teamsService.getTeamById(teamId)
        if (!team) {
            throw new NotFoundException('Team not found')
        }
        if (!token) {
            if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
                throw new ForbiddenException('You are not allowed to access this team')
            }
        }
        const data: TeamMember[] = await this.teamsService.getAssignees(teamId)
        return new NormalizedResponseDTO(data)
    }

    @Get('/:teamId/authors')
    @ApiOperation({
        summary: `List of users who can be authors of a report`,
        description: `List of users who can be authors of a report passing team id`,
    })
    @ApiParam({
        name: 'teamId',
        required: true,
        description: `Id of the team that the report belongs to`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `List of users`, type: TeamMember })
    @ApiHeader({
        name: HEADER_X_KYSO_TEAM,
        description: 'Name of the team',
        required: true,
    })
    @Permission([TeamPermissionsEnum.READ])
    async getAuthors(@Param('teamId') teamId: string): Promise<NormalizedResponseDTO<TeamMember[]>> {
        const data: TeamMember[] = await this.teamsService.getAuthors(teamId)
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
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
        const members: TeamMember[] = await this.teamsService.addMemberToTeam(teamId, userId, [PlatformRole.TEAM_READER_ROLE])
        return new NormalizedResponseDTO(members)
    }

    @Delete('/:teamId/members/:userId')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
    async updateTeam(@CurrentToken() token: Token, @Param('teamId') teamId: string, @Body() data: UpdateTeamRequest): Promise<NormalizedResponseDTO<Team>> {
        const team: Team = await this.teamsService.getTeamById(teamId)
        if (!team) {
            throw new PreconditionFailedException('Team not found')
        }
        const updatedTeam: Team = await this.teamsService.updateTeam(token, { _id: new ObjectId(teamId) }, { $set: data })

        if (data.visibility === TeamVisibilityEnum.PRIVATE) {
            try {
                // The visibility has changed to private, that means no-one will have access to that team
                // For that reason, we will add automatically the requested user as a TEAM_ADMIN of that
                // team.
                const userId = token.id
                await this.teamsService.addMemberToTeam(teamId, userId, [PlatformRole.TEAM_ADMIN_ROLE])
            } catch (ex) {
                Logger.error(`Can't add user ${token.id} to team ${teamId}`, ex)
            }
        }

        return new NormalizedResponseDTO(updatedTeam)
    }

    @Post()
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
        const newTeam: Team = await this.teamsService.createTeam(token, team)
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
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
        const teamMembers: TeamMember[] = await this.teamsService.updateTeamMembersDTORoles(teamId, data)
        return new NormalizedResponseDTO(teamMembers)
    }

    @Delete('/:teamId/members-roles/:userId/:role')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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

    @UseInterceptors(FileInterceptor('file'))
    @Post('/:teamId/profile-picture')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
    public async setProfilePicture(
        @CurrentToken() token: Token,
        @Param('teamId') teamId: string,
        @UploadedFile() file: any,
    ): Promise<NormalizedResponseDTO<Team>> {
        if (!file) {
            throw new BadRequestException(`Missing file`)
        }
        if (file.mimetype.split('/')[0] !== 'image') {
            throw new BadRequestException(`Only image files are allowed`)
        }
        const team: Team = await this.teamsService.setProfilePicture(token, teamId, file)
        return new NormalizedResponseDTO(team)
    }

    @Delete('/:teamId/profile-picture')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
    public async deleteBackgroundImage(@CurrentToken() token: Token, @Param('teamId') teamId: string): Promise<NormalizedResponseDTO<Team>> {
        const team: Team = await this.teamsService.deleteProfilePicture(token, teamId)
        return new NormalizedResponseDTO(team)
    }

    @Delete('/:teamId')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
    public async deleteTeam(@CurrentToken() token: Token, @Param('teamId') teamId: string): Promise<NormalizedResponseDTO<Team>> {
        const team: Team = await this.teamsService.deleteTeam(token, teamId)
        return new NormalizedResponseDTO(team)
    }

    @Post(':teamId/upload-markdown-image')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiParam({
        name: 'teamId',
        required: true,
        description: `id of the team that owns the image`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Upload markdown image`, type: String })
    @UseInterceptors(
        FileInterceptor('file', {
            limits: {
                fileSize: 52428800,
            },
        }),
    )
    public async uploadMarkdownImage(
        @CurrentToken() token: Token,
        @Param('teamId') teamId: string,
        @UploadedFile() file: Express.Multer.File,
    ): Promise<NormalizedResponseDTO<string>> {
        if (!file) {
            throw new BadRequestException(`Missing file`)
        }
        if (file.mimetype.split('/')[0] !== 'image') {
            throw new BadRequestException(`Only image files are allowed`)
        }
        const scsImagePath: string = await this.teamsService.uploadMarkdownImage(token.id, teamId, file)
        return new NormalizedResponseDTO(scsImagePath)
    }
}
