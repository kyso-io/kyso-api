import {
  ChangeRequestAccessDTO,
  HEADER_X_KYSO_ORGANIZATION,
  HEADER_X_KYSO_TEAM,
  KysoSettingsEnum,
  NormalizedResponseDTO,
  Organization,
  OrganizationPermissionsEnum,
  PaginatedResponseDto,
  Report,
  RequestAccess,
  RequestAccessStatusEnum,
  ResourcePermissions,
  Team,
  TeamInfoDto,
  TeamMember,
  TeamPermissionsEnum,
  TeamVisibilityEnum,
  TeamsInfoQuery,
  Token,
  UpdateTeamMembersDTO,
  UpdateTeamRequest,
  User,
  UserRoleDTO,
} from '@kyso-io/kyso-model';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiExtraModels, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Parser } from 'json2csv';
import { ObjectId } from 'mongodb';
import { PlatformRole } from 'src/security/platform-roles';
import { Autowired } from '../../decorators/autowired';
import { Public } from '../../decorators/is-public';
import { GenericController } from '../../generic/controller.generic';
import { QueryParser } from '../../helpers/queryParser';
import slugify from '../../helpers/slugify';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { Permission } from '../auth/annotations/permission.decorator';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { SolvedCaptchaGuard } from '../auth/guards/solved-captcha.guard';
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { RelationsService } from '../relations/relations.service';
import { RequestAccessService } from '../request-access/request-access.service';
import { UsersService } from '../users/users.service';
import { TeamsService } from './teams.service';

@ApiTags('teams')
@ApiExtraModels(Team)
@UseGuards(PermissionsGuard)
@Controller('teams')
export class TeamsController extends GenericController<Team> {
  @Autowired({ typeName: 'RelationsService' })
  private relationsService: RelationsService;

  @Autowired({ typeName: 'OrganizationsService' })
  private organizationsService: OrganizationsService;

  @Autowired({ typeName: 'UsersService' })
  private usersService: UsersService;

  @Autowired({ typeName: 'KysoSettingsService' })
  private kysoSettingsService: KysoSettingsService;

  @Autowired({ typeName: 'RequestAccessService' })
  private requestAccessService: RequestAccessService;

  constructor(private readonly teamsService: TeamsService) {
    super();
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary: `Get all team's in which user has visibility`,
    description: `Allows fetching content of all the teams that the user has visibility`,
  })
  @ApiResponse({
    status: 200,
    description: `User notifications settings`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<Team[]>([Team.createEmpty()]),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
        },
      },
    },
  })
  async getVisibilityTeams(@CurrentToken() token: Token, @Req() req: Request): Promise<NormalizedResponseDTO<Team[]>> {
    const query = QueryParser.toQueryObject(req.url);
    if (!query.sort) {
      query.sort = { created_at: -1 };
    }
    if (!query.filter) {
      query.filter = {};
    }
    let userId: string = token.id;
    if (query.filter?.user_id && query.filter.user_id.length > 0) {
      userId = query.filter.user_id;
      delete query.filter.user_id;
    }

    let teams: Team[] = [];

    if (token.isGlobalAdmin()) {
      teams = await this.teamsService.getTeams(query);
    } else {
      teams = await this.teamsService.getTeamsForController(userId, query);
    }

    return new NormalizedResponseDTO(teams);
  }

  @Get('/info')
  @Public()
  @ApiOperation({
    summary: `Get the number of members, reports, discussions and comments by team`,
    description: `Allows fetching the number of members, reports, discussions and comments by team`,
  })
  @ApiResponse({
    status: 200,
    description: `User notifications settings`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<PaginatedResponseDto<TeamInfoDto>>(PaginatedResponseDto.createEmpty()),
          },
        },
      },
    },
  })
  public async getNumMembersAndReportsByOrganization(@CurrentToken() token: Token, @Query() teamsInfoQuery: TeamsInfoQuery): Promise<NormalizedResponseDTO<PaginatedResponseDto<TeamInfoDto>>> {
    const paginatedResponseDto: PaginatedResponseDto<TeamInfoDto> = await this.teamsService.getTeamsInfo(token, teamsInfoQuery);
    const relations = await this.relationsService.getRelations(paginatedResponseDto.results);
    return new NormalizedResponseDTO(paginatedResponseDto, relations);
  }

  @Get('/:id')
  @Public()
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
  @ApiResponse({
    status: 200,
    description: `User notifications settings`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<Team>(Team.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          forbiddenResource: {
            value: new ForbiddenException('You are not allowed to access this team'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          channelNotFound: {
            value: new NotFoundException('Channel not found'),
          },
        },
      },
    },
  })
  async getTeamById(@CurrentToken() token: Token, @Param('id') id: string): Promise<NormalizedResponseDTO<Team>> {
    const team: Team = await this.teamsService.getTeamById(id);
    if (!team) {
      throw new NotFoundException('Channel not found');
    }
    if (token) {
      const index: number = token.permissions.teams.findIndex((teamResourcePermission: ResourcePermissions) => teamResourcePermission.id === id);
      if (index === -1) {
        if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
          throw new ForbiddenException('You are not allowed to access this team');
        }
      }
    } else {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        throw new ForbiddenException('You are not allowed to access this team');
      }
    }
    let deleteSensitiveData = true;
    if (token) {
      const indexOrg: number = token.permissions.organizations.findIndex((o: ResourcePermissions) => o.id === team.organization_id);
      if (indexOrg !== -1) {
        deleteSensitiveData = !token.permissions.organizations[indexOrg].permissions.includes(OrganizationPermissionsEnum.ADMIN);
      } else {
        const indexTeam: number = token.permissions.teams.findIndex((resourcePermissions: ResourcePermissions) => resourcePermissions.id === team.id);
        if (indexTeam !== -1) {
          deleteSensitiveData = !token.permissions.teams[indexTeam].permissions.includes(TeamPermissionsEnum.ADMIN);
        }
      }
    }
    if (deleteSensitiveData) {
      delete team.roles;
      delete team.slackChannel;
      delete team.teamsIncomingWebhookUrl;
    }
    return new NormalizedResponseDTO(team);
  }

  @Get('/check-name/:organizationId/:name')
  @ApiBearerAuth()
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
  @ApiResponse({
    status: 200,
    description: `Returns true if name is available`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<boolean>(true),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    content: {
      json: {
        examples: {
          teamName: {
            value: new BadRequestException('Team name is required'),
          },
          organizationId: {
            value: new BadRequestException('Organization id is required'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
        },
      },
    },
  })
  @Permission([TeamPermissionsEnum.READ])
  public async checkIfTeamNameIsUnique(@Param('name') name: string, @Param('organizationId') organizationId: string): Promise<NormalizedResponseDTO<boolean>> {
    if (!name || name.length === 0) {
      throw new BadRequestException('Team name is required');
    }
    if (!organizationId || organizationId.length === 0) {
      throw new BadRequestException('Organization id is required');
    }
    const team: Team = await this.teamsService.getUniqueTeam(organizationId, slugify(name));
    return new NormalizedResponseDTO<boolean>(team === null);
  }

  @Get('/:id/members')
  @Public()
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
  @ApiResponse({
    status: 200,
    description: `Team members`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<TeamMember>([TeamMember.createEmpty()]),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          forbidenResource: {
            value: new NotFoundException('You are not allowed to access this team'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          channelNotFound: {
            value: new NotFoundException('Channel not found'),
          },
        },
      },
    },
  })
  async getTeamMembers(@CurrentToken() token: Token, @Param('id') id: string): Promise<NormalizedResponseDTO<TeamMember[]>> {
    const team: Team = await this.teamsService.getTeamById(id);
    if (!team) {
      throw new NotFoundException('Channel not found');
    }
    if (!token) {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        throw new ForbiddenException('You are not allowed to access this team');
      }
    }
    const data: TeamMember[] = await this.teamsService.getMembers(id);
    return new NormalizedResponseDTO(data);
  }

  @Get('/:id/members/export')
  @ApiBearerAuth()
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
  @ApiResponse({
    status: 200,
    description: `Csv file with team members`,
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          forbiddenResource: {
            value: new ForbiddenException('You are not allowed to access this team'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          channelNotFound: {
            value: new NotFoundException('Channel not found'),
          },
        },
      },
    },
  })
  @Permission([OrganizationPermissionsEnum.ADMIN, TeamPermissionsEnum.ADMIN])
  async exportTeamMembers(@CurrentToken() token: Token, @Param('id') id: string, @Res() response: Response): Promise<void> {
    const team: Team = await this.teamsService.getTeamById(id);
    if (!team) {
      throw new NotFoundException('Channel not found');
    }
    const organizationResourcePermissions: ResourcePermissions | undefined = token.permissions.organizations.find(
      (resourcePermissions: ResourcePermissions) => resourcePermissions.id === team.organization_id,
    );
    const isOrgAdmin: boolean = organizationResourcePermissions ? organizationResourcePermissions.permissions.includes(OrganizationPermissionsEnum.ADMIN) : false;
    const teamResourcePermissions: ResourcePermissions | undefined = token.permissions.teams.find((resourcePermissions: ResourcePermissions) => resourcePermissions.id === team.id);
    const isTeamAdmin: boolean = teamResourcePermissions ? teamResourcePermissions.permissions.includes(TeamPermissionsEnum.ADMIN) : false;
    if (!isOrgAdmin && !isTeamAdmin) {
      throw new ForbiddenException('You are not allowed to access this resource');
    }
    const teamMembers: TeamMember[] = await this.teamsService.getMembers(id);
    const data: { display_name: string; email: string; created_at: string; last_login: string }[] = [];
    for (const teamMember of teamMembers) {
      const user: User = await this.usersService.getUserById(teamMember.id);
      if (!user) {
        continue;
      }
      data.push({
        display_name: user.display_name,
        email: user.email,
        created_at: user.created_at.toISOString(),
        last_login: user.last_login ? user.last_login.toISOString() : '',
      });
    }
    // Sort by display_name
    data.sort((a, b) => {
      const display_name_a: string = a.display_name.toLowerCase();
      const display_name_b: string = b.display_name.toLowerCase();
      if (display_name_b > display_name_a) {
        return -1;
      } else if (display_name_b < display_name_a) {
        return 1;
      }
      return 0;
    });
    const parser = new Parser();
    const csv: string = parser.parse(data);
    response.setHeader('Content-Type', 'text/csv');
    response.setHeader('Content-Disposition', `attachment; filename=${team.sluglified_name}-members.csv`);
    response.send(csv);
  }

  @Get('/:teamId/assignees')
  @Public()
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
  @ApiResponse({
    status: 200,
    description: `Users assigned to the team`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<TeamMember>([TeamMember.createEmpty()]),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          forbiddenResource: {
            value: new ForbiddenException('You are not allowed to access this team'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          channelNotFound: {
            value: new NotFoundException('Channel not found'),
          },
        },
      },
    },
  })
  async getAssignees(@CurrentToken() token: Token, @Param('teamId') teamId: string): Promise<NormalizedResponseDTO<TeamMember[]>> {
    const team: Team = await this.teamsService.getTeamById(teamId);
    if (!team) {
      throw new NotFoundException('Channel not found');
    }
    if (token) {
      const index: number = token.permissions.teams.findIndex((teamResourcePermission: ResourcePermissions) => teamResourcePermission.id === team.id);
      if (index === -1) {
        if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
          throw new ForbiddenException('You are not allowed to access this team');
        }
      }
    } else {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        throw new ForbiddenException('You are not allowed to access this team');
      }
    }
    const data: TeamMember[] = await this.teamsService.getAssignees(teamId);
    return new NormalizedResponseDTO(data);
  }

  @Get('/:teamId/authors')
  @ApiBearerAuth()
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
  @ApiParam({
    name: 'teamId',
    required: true,
    description: `Id of the team that the report belongs to`,
    schema: { type: 'string' },
  })
  @ApiOperation({
    summary: `List of users who can be authors of a report`,
    description: `List of users who can be authors of a report passing team id`,
  })
  @ApiResponse({
    status: 200,
    description: `Users assigned to the team`,
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<TeamMember>([TeamMember.createEmpty()]),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          channelNotFound: {
            value: new NotFoundException('Channel not found'),
          },
        },
      },
    },
  })
  @Permission([TeamPermissionsEnum.READ])
  async getAuthors(@Param('teamId') teamId: string): Promise<NormalizedResponseDTO<TeamMember[]>> {
    const data: TeamMember[] = await this.teamsService.getAuthors(teamId);
    return new NormalizedResponseDTO(data);
  }

  @Get('/:teamId/members/:userId')
  @ApiBearerAuth()
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
  @ApiResponse({
    status: 200,
    description: `Check if user is a member of the team`,
    content: {
      json: {
        examples: {
          member: {
            value: new NormalizedResponseDTO<boolean>(true),
          },
          notMember: {
            value: new NormalizedResponseDTO<boolean>(false),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          channelNotFound: {
            value: new NotFoundException('Channel not found'),
          },
        },
      },
    },
  })
  @Permission([TeamPermissionsEnum.READ])
  async getTeamMember(@Param('teamId') teamId: string, @Param('userId') userId: string): Promise<NormalizedResponseDTO<boolean>> {
    const team: Team = await this.teamsService.getTeamById(teamId);
    if (!team) {
      throw new NotFoundException('Channel not found');
    }
    const teamMember: TeamMember[] = await this.teamsService.getMembers(team.id);
    const belongs: boolean = teamMember.findIndex((member: TeamMember) => member.id === userId) !== -1;
    return new NormalizedResponseDTO(belongs);
  }

  @Get('/:organizationId/:teamSlug')
  @Public()
  @ApiOperation({
    summary: `Get a team`,
    description: `Allows fetching content of a specific team passing its id`,
  })
  @ApiParam({
    name: 'organizationId',
    required: true,
    description: `Id of the organization of the team to fetch`,
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'teamSlug',
    required: true,
    description: `Slug the team to fetch`,
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: `Team`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<Team>(Team.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbiddenResource: {
            value: new ForbiddenException('You are not allowed to access this team'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          organizationNotFound: {
            value: new NotFoundException('Organization not found'),
          },
          teamNotFound: {
            value: new NotFoundException('Channel not found'),
          },
        },
      },
    },
  })
  async getTeamBySlug(@CurrentToken() token: Token, @Param('organizationId') organizationId: string, @Param('teamSlug') teamSlug: string): Promise<NormalizedResponseDTO<Team>> {
    const organization: Organization = await this.organizationsService.getOrganizationById(organizationId);
    if (!organization) {
      throw new NotFoundException(`Organization not found`);
    }
    const team: Team = await this.teamsService.getTeam({
      filter: {
        organization_id: organizationId,
        sluglified_name: teamSlug,
      },
    });
    if (!team) {
      throw new NotFoundException('Channel not found');
    }

    if (token) {
      if (!token.isGlobalAdmin()) {
        const index: number = token.permissions.teams.findIndex((teamResourcePermission: ResourcePermissions) => teamResourcePermission.id === team.id);
        if (index === -1) {
          if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
            throw new ForbiddenException('You are not allowed to access this team');
          }
        }
      }
    } else {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        throw new ForbiddenException('You are not allowed to access this team');
      }
    }

    let deleteSensitiveData = true;
    if (token) {
      const indexOrg: number = token.permissions.organizations.findIndex((o: ResourcePermissions) => o.id === organizationId);
      if (indexOrg !== -1) {
        deleteSensitiveData = !token.permissions.organizations[indexOrg].permissions.includes(OrganizationPermissionsEnum.ADMIN);
      } else {
        const indexTeam: number = token.permissions.teams.findIndex((resourcePermissions: ResourcePermissions) => resourcePermissions.id === team.id);
        if (indexTeam !== -1) {
          deleteSensitiveData = !token.permissions.teams[indexTeam].permissions.includes(TeamPermissionsEnum.ADMIN);
        }
      }
    }

    if (deleteSensitiveData) {
      delete team.roles;
      delete team.slackChannel;
      delete team.teamsIncomingWebhookUrl;
    }

    return new NormalizedResponseDTO(team);
  }

  @Patch('/:teamId/members/:userId')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
  @ApiResponse({
    status: 200,
    description: `Team members`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<TeamMember[]>([TeamMember.createEmpty()]),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          userNotFound: {
            value: new NotFoundException('User not found'),
          },
          teamNotFound: {
            value: new NotFoundException('Channel not found'),
          },
          organizationNotFound: {
            value: new NotFoundException('Organization not found'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ConflictException('User already belongs to this team'),
          },
        },
      },
    },
  })
  @Permission([TeamPermissionsEnum.EDIT])
  async addMemberToTeam(@Param('teamId') teamId: string, @Param('userId') userId: string): Promise<NormalizedResponseDTO<TeamMember[]>> {
    const members: TeamMember[] = await this.teamsService.addMemberToTeam(teamId, userId, [PlatformRole.TEAM_READER_ROLE]);
    return new NormalizedResponseDTO(members);
  }

  @Delete('/:teamId/members/:userId')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
  @ApiResponse({
    status: 200,
    description: `Team members`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<TeamMember[]>([TeamMember.createEmpty()]),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          userNotFound: {
            value: new NotFoundException('User not found'),
          },
          teamNotFound: {
            value: new NotFoundException('Channel not found'),
          },
          organizationNotFound: {
            value: new NotFoundException('Organization not found'),
          },
          userIsNotMember: {
            value: new NotFoundException('User is not a member of this team'),
          },
        },
      },
    },
  })
  @Permission([TeamPermissionsEnum.EDIT])
  async removeMemberFromTeam(@Param('teamId') teamId: string, @Param('userId') userId: string): Promise<NormalizedResponseDTO<TeamMember[]>> {
    const members: TeamMember[] = await this.teamsService.removeMemberFromTeam(teamId, userId);
    return new NormalizedResponseDTO(members);
  }

  @Patch('/:teamId')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
  @ApiBody({
    description: 'Update team',
    required: true,
    type: UpdateTeamRequest,
    examples: UpdateTeamRequest.examples(),
  })
  @ApiResponse({
    status: 200,
    description: `Updated team`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<Team>(Team.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbiddenResource: {
            value: new ForbiddenException('This instance of Kyso does not allow public channels'),
          },
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          teamNotFound: {
            value: new NotFoundException('Channel not found'),
          },
        },
      },
    },
  })
  @Permission([TeamPermissionsEnum.EDIT])
  async updateTeam(@CurrentToken() token: Token, @Param('teamId') teamId: string, @Body() updateTeamRequest: UpdateTeamRequest): Promise<NormalizedResponseDTO<Team>> {
    const team: Team = await this.teamsService.getTeamById(teamId);
    if (!team) {
      throw new NotFoundException('Channel not found');
    }

    if (team.visibility !== updateTeamRequest.visibility && updateTeamRequest.visibility === TeamVisibilityEnum.PUBLIC) {
      // The visibility has changed to public, that means that the team will be available to everyone
      const allowPublicChannels: boolean = (await this.kysoSettingsService.getValue(KysoSettingsEnum.ALLOW_PUBLIC_CHANNELS)) === 'true';
      if (!allowPublicChannels) {
        throw new ForbiddenException('This instance of Kyso does not allow public channels');
      }
    }

    delete updateTeamRequest.id;
    delete updateTeamRequest.updated_at;
    delete updateTeamRequest.created_at;
    delete updateTeamRequest.links;
    for (const key in updateTeamRequest) {
      if (updateTeamRequest[key] === undefined) {
        delete updateTeamRequest[key];
      }
    }

    const updatedTeam: Team = await this.teamsService.updateTeam(token, { _id: new ObjectId(teamId) }, { $set: updateTeamRequest });

    if (updateTeamRequest.visibility === TeamVisibilityEnum.PRIVATE) {
      try {
        // The visibility has changed to private, that means no-one will have access to that team
        // For that reason, we will add automatically the requested user as a TEAM_ADMIN of that
        // team.
        const userId = token.id;
        await this.teamsService.addMemberToTeam(teamId, userId, [PlatformRole.TEAM_ADMIN_ROLE]);
      } catch (ex) {
        Logger.error(`Can't add user ${token.id} to team ${teamId}`, ex);
      }
    }

    return new NormalizedResponseDTO(updatedTeam);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
  @ApiOperation({
    summary: `Create a new team`,
    description: `Allows creating a new team`,
  })
  @ApiBody({
    description: 'Create team',
    required: true,
    type: Team,
    examples: Team.examples(),
  })
  @ApiResponse({
    status: 201,
    description: `New team`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<Team>(Team.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException('This instance of Kyso does not allow public channels'),
          },
          reachedLimit: {
            value: new ForbiddenException('You have reached the maximum number of teams you can create'),
          },
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          orgNotFound: {
            value: new NotFoundException('Organization not found'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    content: {
      json: {
        examples: {
          orgNotFound: {
            value: new ConflictException('There is already a user with this sluglified_name'),
          },
        },
      },
    },
  })
  @Permission([TeamPermissionsEnum.CREATE])
  async createTeam(@CurrentToken() token: Token, @Body() team: Team): Promise<NormalizedResponseDTO<Team>> {
    const newTeam: Team = await this.teamsService.createTeam(token, team);
    return new NormalizedResponseDTO(newTeam);
  }

  @Get('/:teamId/reports')
  @ApiBearerAuth()
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
  @ApiResponse({
    status: 200,
    description: `Team reports`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<Report[]>([Report.createEmpty()]),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          notMemberTeam: {
            value: new ForbiddenException('You are not a member of this team and not of the organization'),
          },
          notMemberOrgTeam: {
            value: new ForbiddenException('You are not a member of this team and not of the organization'),
          },
          readPermission: {
            value: new ForbiddenException('User does not have permission to read reports'),
          },
          privateTeam: {
            value: new ForbiddenException('You are not a member of this team'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          teamNotFound: {
            value: new NotFoundException('Channel not found'),
          },
        },
      },
    },
  })
  @Permission([TeamPermissionsEnum.READ])
  async getReportsOfTeam(@CurrentToken() token: Token, @Param('teamId') teamId: string): Promise<NormalizedResponseDTO<Report[]>> {
    const reports: Report[] = await this.teamsService.getReportsOfTeam(token, teamId);
    return new NormalizedResponseDTO(reports);
  }

  @Patch('/:teamId/members-roles')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
  @ApiOperation({
    summary: `Add roles to members of a team`,
    description: `Allows adding a role to a member of a team passing its id`,
  })
  @ApiBody({
    description: 'Update team members',
    required: true,
    examples: {
      json: {
        value: new UpdateTeamMembersDTO([new UserRoleDTO('647f367621b67cfee31314b6', 'team-admin')]),
      },
    },
  })
  @ApiParam({
    name: 'teamId',
    required: true,
    description: `Id of the team to set user roles`,
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: `Updated roles of team members`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<TeamMember[]>([TeamMember.createEmpty()]),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          teamNotFound: {
            value: new NotFoundException('Channel not found'),
          },
          userNotFound: {
            value: new NotFoundException('User not found'),
          },
        },
      },
    },
  })
  @Permission([TeamPermissionsEnum.EDIT])
  public async UpdateTeamMembersDTORoles(@Param('teamId') teamId: string, @Body() data: UpdateTeamMembersDTO): Promise<NormalizedResponseDTO<TeamMember[]>> {
    const teamMembers: TeamMember[] = await this.teamsService.updateTeamMembersDTORoles(teamId, data);
    return new NormalizedResponseDTO(teamMembers);
  }

  @Delete('/:teamId/members-roles/:userId/:role')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
  @ApiResponse({
    status: 200,
    description: `Remove role of user in a team`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<TeamMember[]>([TeamMember.createEmpty()]),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    content: {
      json: {
        examples: {
          userDontHaveRole: {
            value: new BadRequestException('User does not have this role'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          teamNotFound: {
            value: new NotFoundException('Team not found'),
          },
          userNotFound: {
            value: new NotFoundException('User not found'),
          },
          userIsNotMember: {
            value: new NotFoundException('User is not member of this team'),
          },
        },
      },
    },
  })
  @Permission([TeamPermissionsEnum.EDIT])
  public async removeTeamMemberRole(@Param('teamId') teamId: string, @Param('userId') userId: string, @Param('role') role: string): Promise<NormalizedResponseDTO<TeamMember[]>> {
    const teamMembers: TeamMember[] = await this.teamsService.removeTeamMemberRole(teamId, userId, role);
    return new NormalizedResponseDTO(teamMembers);
  }

  @Get('/:teamId/members/:userId')
  @ApiBearerAuth()
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
    const belongs: boolean = await this.teamsService.userBelongsToTeam(teamId, userId);
    return new NormalizedResponseDTO(belongs);
  }

  @Post('/:teamId/profile-picture')
  @UseInterceptors(FileInterceptor('file'))
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
  @ApiOperation({
    summary: `Upload a profile picture for a team`,
    description: `Allows uploading a profile picture for a team passing its id and image`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiParam({
    name: 'teamId',
    required: true,
    description: `Id of the team to fetch`,
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 201,
    description: `Updated team`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<Team>(Team.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    content: {
      json: {
        examples: {
          missingImage: {
            value: new BadRequestException('Missing file'),
          },
          onlyImagesAllowed: {
            value: new BadRequestException('Only image files are allowed'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          teamNotFound: {
            value: new NotFoundException('Team not found'),
          },
        },
      },
    },
  })
  @Permission([TeamPermissionsEnum.EDIT])
  public async setProfilePicture(@CurrentToken() token: Token, @Param('teamId') teamId: string, @UploadedFile() file: Express.Multer.File): Promise<NormalizedResponseDTO<Team>> {
    if (!file) {
      throw new BadRequestException(`Missing file`);
    }
    if (file.mimetype.split('/')[0] !== 'image') {
      throw new BadRequestException(`Only image files are allowed`);
    }
    const team: Team = await this.teamsService.setProfilePicture(token, teamId, file);
    return new NormalizedResponseDTO(team);
  }

  @Delete('/:teamId/profile-picture')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
  @ApiResponse({
    status: 200,
    description: `Updated team`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<Team>(Team.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          teamNotFound: {
            value: new NotFoundException('Team not found'),
          },
        },
      },
    },
  })
  public async deleteBackgroundImage(@CurrentToken() token: Token, @Param('teamId') teamId: string): Promise<NormalizedResponseDTO<Team>> {
    const team: Team = await this.teamsService.deleteProfilePicture(token, teamId);
    return new NormalizedResponseDTO(team);
  }

  @Delete('/:teamId')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
  @ApiResponse({
    status: 200,
    description: `Deleted team`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<Team>(Team.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          teamNotFound: {
            value: new NotFoundException('Channel not found'),
          },
        },
      },
    },
  })
  @Permission([OrganizationPermissionsEnum.ADMIN, TeamPermissionsEnum.ADMIN, TeamPermissionsEnum.DELETE])
  public async deleteTeam(@CurrentToken() token: Token, @Param('teamId') teamId: string): Promise<NormalizedResponseDTO<Team>> {
    const team: Team = await this.teamsService.deleteTeam(token, teamId);
    return new NormalizedResponseDTO(team);
  }

  // @Post(':teamId/upload-markdown-image')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiParam({
    name: 'teamId',
    required: true,
    description: `id of the team that owns the image`,
    schema: { type: 'string' },
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: `Url upload markdown image`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<Team>(Team.createEmpty()),
          },
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 52428800,
      },
    }),
  )
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    content: {
      json: {
        examples: {
          missingImage: {
            value: new BadRequestException('Missing file'),
          },
          onlyImagesAllowed: {
            value: new BadRequestException('Only image files are allowed'),
          },
        },
      },
    },
  })
  public async uploadMarkdownImage(@CurrentToken() token: Token, @Param('teamId') teamId: string, @UploadedFile() file: Express.Multer.File): Promise<NormalizedResponseDTO<string>> {
    if (!file) {
      throw new BadRequestException(`Missing file`);
    }
    if (file.mimetype.split('/')[0] !== 'image') {
      throw new BadRequestException(`Only image files are allowed`);
    }
    const scsImagePath: string = await this.teamsService.uploadMarkdownImage(token.id, teamId, file);
    return new NormalizedResponseDTO(scsImagePath);
  }

  @Post('/:organizationSlug/:teamSlug/request-access')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Request access to a team`,
    description: `By passing the appropiate parameters you request access to a team`,
  })
  @ApiParam({
    name: 'organizationSlug',
    required: true,
    description: `Slug of the organization to fetch`,
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'teamSlug',
    required: true,
    description: `Slug of the team to fetch`,
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 201,
    description: `Request created successfully`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<RequestAccess>(RequestAccess.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    content: {
      json: {
        examples: {
          teamNotFound: {
            value: new BadRequestException('No administrator admins found for this organization'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          orgNotFound: {
            value: new NotFoundException('Organization not found'),
          },
          teamNotFound: {
            value: new NotFoundException('Team not found'),
          },
          userNotFound: {
            value: new NotFoundException('User not found'),
          },
        },
      },
    },
  })
  public async requestAccessToTeam(
    @CurrentToken() token: Token,
    @Param('organizationSlug') organizationSlug: string,
    @Param('teamSlug') teamSlug: string,
  ): Promise<NormalizedResponseDTO<RequestAccess>> {
    const requestAccess: RequestAccess = await this.requestAccessService.requestAccessToTeam(token.id, organizationSlug, teamSlug);
    return new NormalizedResponseDTO<RequestAccess>(requestAccess);
  }

  @Get('/:teamId/request-access/:requestAccessId/:secret/:changerId/:newStatus')
  @Public()
  @ApiOperation({
    summary: `Request access to an organization`,
    description: `By passing the appropiate parameters you request access to an organization`,
  })
  @ApiParam({
    name: 'teamId',
    required: true,
    description: `Id of the team to fetch`,
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'requestAccessId',
    required: true,
    description: `Id of the request access to fetch`,
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'secret',
    required: true,
    description: `Secret of the request access to fetch`,
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'changerId',
    required: true,
    description: `Id of the user that is changing the role of the request`,
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'newStatus',
    required: true,
    description: `New role for the user`,
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: `Accepted/rejected reqeust`,
    content: {
      json: {
        examples: {
          json: {
            value: new NormalizedResponseDTO<RequestAccess>(RequestAccess.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    content: {
      json: {
        examples: {
          invalidRole: {
            value: new BadRequestException('Invalid role provided. Only reader and contributor roles are permitted'),
          },
          invalidUser: {
            value: new BadRequestException('Invalid user provided'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          channelsMismatch: {
            value: new ForbiddenException('Channels identifiers mismatch'),
          },
          secretsMismatch: {
            value: new ForbiddenException('Secrets mismatch'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          teamNotFound: {
            value: new NotFoundException('Channel not found'),
          },
        },
      },
    },
  })
  public async changeRequestAccessStatus(
    @Param('teamId') teamId: string,
    @Param('requestAccessId') requestAccessId: string,
    @Param('secret') secret: string,
    @Param('changerId') changerId: string,
    @Param('newStatus') newStatus: RequestAccessStatusEnum,
  ) {
    let role;

    switch (RequestAccessStatusEnum[newStatus]) {
      case RequestAccessStatusEnum.ACCEPTED_AS_CONTRIBUTOR:
        role = PlatformRole.TEAM_CONTRIBUTOR_ROLE.name;
        break;
      case RequestAccessStatusEnum.ACCEPTED_AS_READER:
        role = PlatformRole.TEAM_READER_ROLE.name;
        break;
      case RequestAccessStatusEnum.REJECTED:
        role = 'none';
        break;
      default:
        role = null;
        break;
    }

    if (!role) {
      throw new BadRequestException(
        `Invalid newStatus. Valid values are ${RequestAccessStatusEnum.ACCEPTED_AS_CONTRIBUTOR}, ${RequestAccessStatusEnum.ACCEPTED_AS_READER} or ${RequestAccessStatusEnum.REJECTED}`,
      );
    }

    const changeRequest: ChangeRequestAccessDTO = new ChangeRequestAccessDTO(secret, role, newStatus);

    switch (changeRequest.new_status) {
      case RequestAccessStatusEnum.ACCEPTED_AS_READER:
      case RequestAccessStatusEnum.ACCEPTED_AS_CONTRIBUTOR:
        await this.requestAccessService.acceptTeamRequest(teamId, requestAccessId, changeRequest.role, changeRequest.secret, changerId);
        return `Request accepted successfully`;
      case RequestAccessStatusEnum.REJECTED:
        await this.requestAccessService.rejectTeamRequest(teamId, requestAccessId, changeRequest.secret, changerId);
        return `Request rejected successfully`;
      default:
        throw new BadRequestException(`Status provided is invalid`);
    }
  }
}
