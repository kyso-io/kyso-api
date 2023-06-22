import {
  AnalyticsSource,
  Comment,
  DraftReport,
  EntityEnum,
  File,
  GitCommit,
  GithubFileHash,
  GlobalPermissionsEnum,
  HEADER_X_KYSO_ORGANIZATION,
  HEADER_X_KYSO_TEAM,
  KysoAnalyticsReportDownload,
  KysoAnalyticsReportShare,
  KysoEventEnum,
  KysoSetting,
  KysoSettingsEnum,
  MoveReportDto,
  NormalizedResponseDTO,
  Organization,
  PaginatedResponseDto,
  PinnedReport,
  Report,
  ReportAnalytics,
  ReportDTO,
  ReportPermissionsEnum,
  ResourcePermissions,
  Tag,
  TagAssign,
  Team,
  TeamVisibilityEnum,
  Token,
  UpdateReportRequestDTO,
  User,
} from '@kyso-io/kyso-model';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Logger,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  PreconditionFailedException,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiExtraModels, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import axios, { AxiosResponse } from 'axios';
import { Request } from 'express';
import * as moment from 'moment';
import { ObjectId } from 'mongodb';
import { FormDataRequest } from 'nestjs-form-data';
import { RealIP } from 'nestjs-real-ip';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
import { Autowired } from '../../decorators/autowired';
import { Public } from '../../decorators/is-public';
import { GenericController } from '../../generic/controller.generic';
import { NATSHelper } from '../../helpers/natsHelper';
import { QueryParser } from '../../helpers/queryParser';
import slugify from '../../helpers/slugify';
import { Validators } from '../../helpers/validators';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { Permission } from '../auth/annotations/permission.decorator';
import { AuthService } from '../auth/auth.service';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { SolvedCaptchaGuard } from '../auth/guards/solved-captcha.guard';
import { CommentsService } from '../comments/comments.service';
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { RelationsService } from '../relations/relations.service';
import { TagsService } from '../tags/tags.service';
import { TeamsService } from '../teams/teams.service';
import { UsersService } from '../users/users.service';
import { CreateKysoReportVersionDto } from './create-kyso-report-version.dto';
import { CreateKysoReportDto } from './create-kyso-report.dto';
import { PinnedReportsMongoProvider } from './providers/mongo-pinned-reports.provider';
import { ReportsService } from './reports.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const aqp = require('api-query-params');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ipaddr = require('ipaddr.js');

@ApiExtraModels(Report, NormalizedResponseDTO)
@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
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
export class ReportsController extends GenericController<Report> {
  @Autowired({ typeName: 'CommentsService' })
  private commentsService: CommentsService;

  @Autowired({ typeName: 'ReportsService' })
  private reportsService: ReportsService;

  @Autowired({ typeName: 'RelationsService' })
  private relationsService: RelationsService;

  @Autowired({ typeName: 'TeamsService' })
  private teamsService: TeamsService;

  @Autowired({ typeName: 'OrganizationsService' })
  private organizationsService: OrganizationsService;

  @Autowired({ typeName: 'TagsService' })
  private tagsService: TagsService;

  @Autowired({ typeName: 'KysoSettingsService' })
  private kysoSettingsService: KysoSettingsService;

  @Autowired({ typeName: 'UsersService' })
  private usersService: UsersService;

  constructor(
    private readonly emailVerifiedGuard: EmailVerifiedGuard,
    private readonly pinnedReportsMongoProvider: PinnedReportsMongoProvider,
    private readonly solvedCaptchaGuard: SolvedCaptchaGuard,
    @Inject('NATS_SERVICE') private client: ClientProxy,
  ) {
    super();
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @ApiOperation({
    summary: `Search and fetch reports`,
    description: `By passing the appropiate parameters you can fetch and filter the reports available to the authenticated user.<br />
         **This endpoint supports filtering**. Refer to the Report schema to see available options.`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Reports matching criteria`,
    type: ReportDTO,
    isArray: true,
  })
  async getReports(@CurrentToken() token: Token, @Req() req): Promise<NormalizedResponseDTO<ReportDTO[]>> {
    const query = QueryParser.toQueryObject(req.url);
    if (!query.sort) query.sort = { created_at: -1 };
    if (!query.filter) query.filter = {};

    if (!query.filter.hasOwnProperty('team_id') || query.filter.team_id == null || query.filter.team_id === '') {
      const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id);
      query.filter.team_id = { $in: teams.map((team: Team) => team.id) };
      if (token.permissions?.global && token.permissions.global.includes(GlobalPermissionsEnum.GLOBAL_ADMIN)) {
        delete query.filter.team_id;
      }
      if (query?.filter?.organization_id) {
        const organizationTeams: Team[] = await this.teamsService.getTeams({ filter: { organization_id: query.filter.organization_id } });
        query.filter.team_id = { $in: organizationTeams.map((team: Team) => team.id) };
        delete query.filter.organization_id;
      }
    }

    if (query?.filter?.$text) {
      const newFilter = { ...query.filter };

      newFilter.$or = [
        {
          sluglified_name: { $regex: `${query.filter.$text.$search}`, $options: 'i' },
        },
        {
          title: { $regex: `${query.filter.$text.$search}`, $options: 'i' },
        },
        {
          description: { $regex: `${query.filter.$text.$search}`, $options: 'i' },
        },
      ];
      delete newFilter.$text;
      query.filter = newFilter;
    }

    let version = null;
    if (query?.filter?.version && query.filter.version > 0) {
      version = query.filter.version;
      delete query.filter.version;
    }

    if (query?.filter?.sluglified_name && !isNaN(query.filter.sluglified_name)) {
      query.filter.sluglified_name = query.filter.sluglified_name.toString();
    }

    const reports: Report[] = await this.reportsService.getReports(query);
    const reportsDtos: ReportDTO[] = await Promise.all(reports.map((report: Report) => this.reportsService.reportModelToReportDTO(report, token.id, version)));
    if (query.filter?.team_id && query.filter?.sluglified_name && reportsDtos.length === 1) {
      await this.reportsService.increaseViews({ _id: new ObjectId(reportsDtos[0].id) });
      reportsDtos[0].views++;
    }
    const relations = await this.relationsService.getRelations(reports, 'report', { Author: 'User' });
    return new NormalizedResponseDTO(reportsDtos, relations);
  }

  @Get('lines')
  @Public()
  @ApiOperation({
    summary: `Get content of a file`,
    description: `By passing the id a file, get its raw content directly from the source.`,
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Id of the report to fetch',
    schema: { type: 'string' },
  })
  async getLinesOfReportFile(
    @CurrentToken() token: Token,
    @Query('fileId') fileId: string,
    @Query('beginLine', ParseIntPipe) beginLine: number,
    @Query('endLine', ParseIntPipe) endLine: number,
  ): Promise<NormalizedResponseDTO<string>> {
    const file: File = await this.reportsService.getFileById(fileId);
    if (!file) {
      throw new PreconditionFailedException('File not found');
    }
    const report: Report = await this.reportsService.getReportById(file.report_id);
    if (!report) {
      throw new PreconditionFailedException('Report not found');
    }
    const team: Team = await this.teamsService.getTeamById(report.team_id);
    if (!token) {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        throw new PreconditionFailedException(`Report is not public`);
      }
    } else {
      const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id);
      const index: number = teams.findIndex((t: Team) => t.id === team.id);
      if (index === -1) {
        throw new ForbiddenException('You do not have permissions to access this report');
      }
    }
    const lines: string = await this.reportsService.getLinesOfReportFile(file, beginLine, endLine);
    return new NormalizedResponseDTO(lines);
  }

  @Get('paginated')
  @Public()
  @ApiOperation({
    summary: `Search and fetch reports`,
    description: `By passing the appropiate parameters you can fetch and filter the reports available to the authenticated user.<br />
         **This endpoint supports filtering**. Refer to the Report schema to see available options.`,
  })
  async getPaginatedReports(@CurrentToken() token: Token, @Req() req): Promise<NormalizedResponseDTO<PaginatedResponseDto<ReportDTO>>> {
    const data = aqp(req._parsedUrl.query);
    if (!data.limit) {
      data.limit = 10;
    }
    if (!data.sort) {
      data.sort = { created_at: -1 };
    }
    if (!data.hasOwnProperty('skip')) {
      data.skip = 0;
    }
    if (!data.filter.hasOwnProperty('organization_id') && !data.filter.hasOwnProperty('team_id')) {
      throw new BadRequestException('You must specify an organization_id or team_id');
    }
    const paginatedResponseDto: PaginatedResponseDto<ReportDTO> = new PaginatedResponseDto<ReportDTO>(0, 0, 0, [], 0, 0);
    if (!token) {
      if (data.filter.organization_id) {
        const organization: Organization = await this.organizationsService.getOrganizationById(data.filter.organization_id);
        if (!organization) {
          throw new BadRequestException('Organization not found');
        }
        const teams: Team[] = await this.teamsService.getTeams({
          filter: { organization_id: data.filter.organization_id, visibility: TeamVisibilityEnum.PUBLIC },
        });
        if (teams.length === 0) {
          return new NormalizedResponseDTO(paginatedResponseDto);
        }
        delete data.filter.organization_id;
        data.filter.team_id = {
          $in: teams.map((team: Team) => team.id),
        };
      } else {
        const team: Team = await this.teamsService.getTeamById(data.filter.team_id);
        if (!team) {
          throw new BadRequestException('Team not found');
        }
        if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
          throw new ForbiddenException('Team not public');
        }
      }
    } else {
      let teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id);
      if (data.filter.organization_id) {
        teams = teams.filter((team: Team) => team.organization_id === data.filter.organization_id);
        if (teams.length === 0) {
          return new NormalizedResponseDTO(paginatedResponseDto);
        }
        data.filter.team_id = {
          $in: teams.map((team: Team) => team.id),
        };
        delete data.filter.organization_id;
      } else {
        const team: Team = await this.teamsService.getTeamById(data.filter.team_id);
        if (!team) {
          throw new BadRequestException('Team not found');
        }
        if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
          const indexTeam: number = teams.findIndex((t: Team) => t.id === team.id);
          if (indexTeam === -1) {
            throw new ForbiddenException('Team not public');
          }
        }
      }
    }
    if (data.filter.tag) {
      const filterTags: any = {};
      if (data.filter.tag?.$in) {
        filterTags.$or = data.filter.tag.$in.map((tag: string) => ({ name: { $regex: `${tag}`, $options: 'i' } }));
      } else {
        filterTags.name = { $regex: `${data.filter.tag}`, $options: 'i' };
      }
      const tags: Tag[] = await this.tagsService.getTags({
        filter: filterTags,
        projection: {
          _id: 1,
        },
      });
      if (tags.length === 0) {
        return new NormalizedResponseDTO(paginatedResponseDto);
      }
      const tagAssigns: TagAssign[] = await this.tagsService.getTagAssigns({
        filter: {
          tag_id: { $in: tags.map((tag: Tag) => tag.id) },
          type: EntityEnum.REPORT,
        },
        projection: {
          _id: 1,
          entity_id: 1,
        },
      });
      if (tagAssigns.length === 0) {
        return new NormalizedResponseDTO(paginatedResponseDto);
      }
      let ids: ObjectId[] = tagAssigns.map((tagAssign: TagAssign) => new ObjectId(tagAssign.entity_id));
      ids = ids.filter((id: ObjectId, index: number) => ids.indexOf(id) === index);
      data.filter._id = {
        $in: ids,
      };
      delete data.filter.tag;
    }
    if (data.filter['user-pinned']) {
      const pinnedReports: PinnedReport[] = await this.pinnedReportsMongoProvider.read({
        filter: {
          user_id: token.id,
        },
        projection: {
          _id: 1,
          report_id: 1,
        },
      });
      if (pinnedReports.length === 0) {
        return new NormalizedResponseDTO(paginatedResponseDto);
      }
      const prs: Report[] = await this.reportsService.getReports({
        filter: {
          _id: { $in: pinnedReports.map((pinnedReport: PinnedReport) => new ObjectId(pinnedReport.report_id)) },
        },
        projection: {
          _id: 1,
          team_id: 1,
        },
      });
      if (prs.length === 0) {
        return new NormalizedResponseDTO(paginatedResponseDto);
      }
      if (data.filter.hasOwnProperty('_id')) {
        // Delete reports with tags that did not pin by user
        const ids = [...data.filter._id.$in];
        for (const id of ids) {
          const index = prs.findIndex((pr: Report) => pr.id === id.toString());
          if (index !== -1) {
            prs.splice(index, 1);
          }
        }
        data.filter._id = {
          $in: ids,
        };
      } else {
        data.filter._id = {
          $in: prs.map((report: Report) => new ObjectId(report.id)),
        };
      }
      delete data.filter['user-pinned'];
    }
    if (data.filter.text) {
      const text: string = data.filter.text;
      delete data.filter.text;
      data.filter.$or = [{ title: { $regex: `${text}`, $options: 'i' } }, { description: { $regex: `${text}`, $options: 'i' } }];
    }
    if (data.filter.hasOwnProperty('created_at')) {
      if (data.filter.created_at.hasOwnProperty('$gt')) {
        const date: Date = data.filter.created_at.$gt;
        data.filter.created_at = {
          $gt: moment(date).endOf('day').toDate(),
        };
      } else if (data.filter.created_at.hasOwnProperty('$lt')) {
        const date: Date = data.filter.created_at.$lt;
        data.filter.created_at = {
          $lt: moment(date).startOf('day').toDate(),
        };
      } else {
        const date: Date = data.filter.created_at;
        data.filter.created_at = {
          $gt: moment(date).startOf('day').toDate(),
          $lt: moment(date).add(1, 'days').startOf('day').toDate(),
        };
      }
    }
    if (data.filter.hasOwnProperty('updated_at')) {
      if (data.filter.updated_at.hasOwnProperty('$gt')) {
        const date: Date = data.filter.updated_at.$gt;
        data.filter.updated_at = {
          $gt: moment(date).endOf('day').toDate(),
        };
      } else if (data.filter.updated_at.hasOwnProperty('$lt')) {
        const date: Date = data.filter.updated_at.$lt;
        data.filter.updated_at = {
          $lt: moment(date).startOf('day').toDate(),
        };
      } else {
        const date: Date = data.filter.updated_at;
        data.filter.updated_at = {
          $gt: moment(date).startOf('day').toDate(),
          $lt: moment(date).add(1, 'days').startOf('day').toDate(),
        };
      }
    }
    return this.getNormalizedResponsePaginatedReports(token, data);
  }

  @Get('user/:user_id')
  @Public()
  @ApiOperation({
    summary: `Search and fetch reports`,
    description: `By passing the appropiate parameters you can fetch and filter the reports available for a user.<br />
         **This endpoint supports filtering**. Refer to the Report schema to see available options.`,
  })
  async getPaginatedUserReports(@CurrentToken() token: Token, @Req() req, @Param('user_id') user_id: string): Promise<NormalizedResponseDTO<PaginatedResponseDto<ReportDTO>>> {
    if (!user_id || !Validators.isValidObjectId(user_id)) {
      throw new BadRequestException('You must specify an valid user_id');
    }
    const data = aqp(req._parsedUrl.query);
    delete data.filter;
    if (!data.limit) {
      data.limit = 10;
    }
    if (!data.sort) {
      data.sort = { created_at: -1 };
    }
    if (!data.hasOwnProperty('skip')) {
      data.skip = 0;
    }
    data.filter = {
      $or: [
        {
          user_id,
        },
        {
          author_ids: {
            $in: [user_id],
          },
        },
      ],
    };
    const paginatedResponseDto: PaginatedResponseDto<ReportDTO> = new PaginatedResponseDto<ReportDTO>(0, 0, 0, [], 0, 0);
    if (token) {
      const userTokenTeams: Team[] = await this.teamsService.getTeamsVisibleForUser(user_id);
      if (token.id === user_id) {
        if (userTokenTeams.length === 0) {
          return new NormalizedResponseDTO(paginatedResponseDto);
        }
        data.filter.team_id = {
          $in: userTokenTeams.map((team: Team) => team.id),
        };
      } else {
        const desiredUserTeams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id);
        if (desiredUserTeams.length === 0) {
          return new NormalizedResponseDTO(paginatedResponseDto);
        }
        const teamIds: string[] = [];
        for (const team of desiredUserTeams) {
          if (team.visibility === TeamVisibilityEnum.PUBLIC) {
            teamIds.push(team.id);
          } else {
            const userTeam: Team = userTokenTeams.find((t: Team) => t.id === team.id);
            if (userTeam) {
              teamIds.push(team.id);
            }
          }
        }
        if (teamIds.length === 0) {
          return new NormalizedResponseDTO(paginatedResponseDto);
        }
        data.filter.team_id = {
          $in: teamIds,
        };
      }
    } else {
      let userTeams: Team[] = await this.teamsService.getTeamsVisibleForUser(user_id);
      userTeams = userTeams.filter((t: Team) => t.visibility === TeamVisibilityEnum.PUBLIC);
      if (userTeams.length === 0) {
        return new NormalizedResponseDTO(paginatedResponseDto);
      }
      data.filter.team_id = {
        $in: userTeams.map((team: Team) => team.id),
      };
    }
    return this.getNormalizedResponsePaginatedReports(token, data);
  }

  @Get('/pinned')
  @UseGuards(PermissionsGuard)
  @ApiOperation({
    summary: `Get pinned reports for a user`,
    description: `Allows fetching pinned reports of a specific user passing its id`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `All the pinned reports of a user`,
    type: ReportDTO,
  })
  @ApiParam({
    name: 'userId',
    required: true,
    description: 'Id of the owner of the report to fetch',
    schema: { type: 'string' },
  })
  @Permission([ReportPermissionsEnum.READ])
  async getPinnedReportsForUser(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<ReportDTO[]>> {
    const reports: Report[] = await this.reportsService.getPinnedReportsForUser(token.id);
    const reportsDtos: ReportDTO[] = await Promise.all(reports.map((report: Report) => this.reportsService.reportModelToReportDTO(report, token.id)));
    const relations = await this.relationsService.getRelations(reports, 'report', { Author: 'User' });
    return new NormalizedResponseDTO(reportsDtos, relations);
  }

  @Get('/diff/:reportId')
  @ApiOperation({
    summary: `Get diff between two files`,
    description: `By passing the appropiate parameters you can get the diff between two files`,
  })
  @ApiResponse({
    status: 200,
    description: `Diff between two files`,
  })
  @ApiResponse({
    status: 404,
    description: `File not found`,
  })
  @ApiResponse({
    status: 500,
    description: `Internal server error`,
  })
  @Public()
  public async getDiffBetweenFiles(
    @CurrentToken() token: Token,
    @Param('reportId') reportId: string,
    @Query('sourceFileId') sourceFileId: string,
    @Query('targetFileId') targetFileId: string,
  ): Promise<NormalizedResponseDTO<any>> {
    const report: Report = await this.reportsService.getReportById(reportId);
    if (!report) {
      throw new PreconditionFailedException('Report not found');
    }
    const team: Team = await this.teamsService.getTeamById(report.team_id);
    if (!team) {
      throw new PreconditionFailedException('Team not found');
    }
    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
    if (!organization) {
      throw new NotFoundException(`Organization with id ${team.organization_id} not found`);
    }
    if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
      const hasPermissions: boolean = AuthService.hasPermissions(token, [ReportPermissionsEnum.READ], team, organization);
      if (!hasPermissions) {
        throw new ForbiddenException('You do not have permissions to access get file differences');
      }
    }
    const result: any = await this.reportsService.getDiffBetweenFiles(sourceFileId, targetFileId);
    return new NormalizedResponseDTO(result);
  }

  @Get('/:reportId')
  @ApiOperation({
    summary: `Get a report`,
    description: `Allows fetching content of a specific report passing its id`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Report matching id`,
    type: ReportDTO,
  })
  @ApiParam({
    name: 'reportId',
    required: true,
    description: 'Id of the report to fetch',
    schema: { type: 'string' },
  })
  async getReportById(@CurrentToken() token: Token, @RealIP() realIp: string, @Req() request: Request, @Param('reportId') reportId: string): Promise<NormalizedResponseDTO<ReportDTO>> {
    const report: Report = await this.reportsService.getReportById(reportId);
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    const team: Team = await this.teamsService.getTeamById(report.team_id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
    if (!organization) {
      throw new NotFoundException(`Organization with id ${team.organization_id} not found`);
    }
    if (token) {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        const index: number = token.permissions.teams.findIndex((t: ResourcePermissions) => t.id === team.id);
        if (index === -1) {
          throw new ForbiddenException('You do not have permissions to access this report');
        }
      }
    } else {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        throw new ForbiddenException('You do not have permissions to access this report');
      }
    }
    await this.reportsService.increaseViews({ _id: new ObjectId(reportId) });
    report.views++;
    const user_id: string | null = token ? token.id : null;
    const user_agent: string = request.headers['user-agent'] || null;
    if (ipaddr.isValid(realIp)) {
      const addr: any = ipaddr.parse(realIp);
      if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
        realIp = addr.toIPv4Address().toString();
      }
    }
    this.reportsService.sendReportViewEvent(report.id, user_id, realIp, user_agent);
    const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' });
    const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id);
    return new NormalizedResponseDTO(reportDto, relations);
  }

  @Get('/:reportId/analytics')
  @ApiOperation({
    summary: `Get report analytics`,
    description: `Allows fetching analytics of a specific report passing its id`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Report analytics matching id`,
    type: ReportAnalytics,
  })
  @ApiParam({
    name: 'reportId',
    required: true,
    description: 'Id of the report to fetch its analitycs',
    schema: { type: 'string' },
  })
  async getReportAnalytics(@CurrentToken() token: Token, @Param('reportId') reportId: string): Promise<NormalizedResponseDTO<ReportAnalytics>> {
    const report: Report = await this.reportsService.getReportById(reportId);
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    const team: Team = await this.teamsService.getTeamById(report.team_id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
    if (!organization) {
      throw new NotFoundException(`Organization with id ${team.organization_id} not found`);
    }
    if (token) {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        const index: number = token.permissions.teams.findIndex((t: ResourcePermissions) => t.id === team.id);
        if (index === -1) {
          throw new ForbiddenException('You do not have permissions to access this report');
        }
      }
    } else {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        throw new ForbiddenException('You do not have permissions to access this report');
      }
    }
    const reportAnalytics: ReportAnalytics = await this.reportsService.getReportAnalytics(report.id);
    const relations = await this.relationsService.getRelations(reportAnalytics);
    const normalizedResponseDto: NormalizedResponseDTO<ReportAnalytics> = new NormalizedResponseDTO(reportAnalytics, relations);
    const user_ids: { [id: string]: User } = {};
    for (const e of reportAnalytics.downloads.last_items) {
      if (e.user_id && !user_ids[e.user_id]) {
        user_ids[e.user_id] = null;
      }
    }
    for (const e of reportAnalytics.views.last_items) {
      if (e.user_id && !user_ids[e.user_id]) {
        user_ids[e.user_id] = null;
      }
    }
    for (const e of reportAnalytics.shares.last_items) {
      if (e.user_id && !user_ids[e.user_id]) {
        user_ids[e.user_id] = null;
      }
    }
    const userIds: string[] = [];
    for (const id in user_ids) {
      userIds.push(id);
    }
    if (userIds.length > 0) {
      const users: User[] = await this.usersService.getUsers({
        filter: {
          id: {
            $in: userIds,
          },
        },
      });
      normalizedResponseDto.relations['user'] = {};
      for (const user of users) {
        normalizedResponseDto.relations['user'][user.id] = {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
        };
      }
    }
    return normalizedResponseDto;
  }

  @Get('/:reportId/comments')
  @ApiOperation({
    summary: `Get comments of a report`,
    description: `By passing in the appropriate options you can see all the comments of a report`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Comments of the specified report`,
    type: Comment,
    isArray: true,
  })
  @ApiParam({
    name: 'reportId',
    required: true,
    description: 'Id of the report to fetch',
    schema: { type: 'string' },
  })
  @Public()
  async getComments(@CurrentToken() token: Token, @Param('reportId') reportId: string, @Req() req): Promise<NormalizedResponseDTO<Comment[]>> {
    const report: Report = await this.reportsService.getReportById(reportId);
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    const team: Team = await this.teamsService.getTeamById(report.team_id);
    if (token) {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        const index: number = token.permissions.teams.findIndex((t: ResourcePermissions) => t.id === team.id);
        if (index === -1) {
          throw new ForbiddenException('You do not have permissions to access the comments of this report');
        }
      }
    } else {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        throw new ForbiddenException('You do not have permissions to access the comments of this report');
      }
    }
    const query = QueryParser.toQueryObject(req.url);
    if (!query.sort) {
      query.sort = { created_at: -1 };
    }
    const comments: Comment[] = await this.commentsService.getComments({ filter: { report_id: reportId }, sort: query.sort });
    const relations = await this.relationsService.getRelations(comments, 'comment');
    return new NormalizedResponseDTO(
      comments.filter((comment: Comment) => !comment.comment_id),
      relations,
    );
  }

  @Get('/:teamId/:reportName/exists')
  @UseGuards(PermissionsGuard)
  @ApiOperation({
    summary: `Check if report exists`,
    description: `Allows checking if a report exists passing its name and team name`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Report matching name and team name`,
    type: Boolean,
  })
  @ApiParam({
    name: 'reportName',
    required: true,
    description: 'Name of the report to check',
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'teamId',
    required: true,
    description: 'Id of the team to check',
    schema: { type: 'string' },
  })
  @Permission([ReportPermissionsEnum.READ])
  async checkReport(@Param('teamId') teamId: string, @Param('reportName') reportName: string): Promise<boolean> {
    const report: Report = await this.reportsService.getReport({ filter: { sluglified_name: slugify(reportName), team_id: teamId } });
    return report != null;
  }

  @Get('/embedded/:organizationName/:teamName/:reportName')
  @Public()
  @ApiOperation({
    summary: `Get a report`,
    description: `Allows fetching content of a specific report passing its id`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Report matching id`,
    type: ReportDTO,
  })
  @ApiParam({
    name: 'organizationName',
    required: true,
    description: 'Name of the organization to fetch',
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'teamName',
    required: true,
    description: 'Name of the team to fetch',
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'reportName',
    required: true,
    description: 'Name of the report to fetch',
    schema: { type: 'string' },
  })
  async getEmbeddedReport(
    @CurrentToken() token: Token,
    @Param('organizationName') organizationName: string,
    @Param('teamName') teamName: string,
    @Param('reportName') reportName: string,
  ): Promise<NormalizedResponseDTO<ReportDTO>> {
    const organization: Organization = await this.organizationsService.getOrganization({ filter: { sluglified_name: organizationName } });
    if (!organization) {
      throw new PreconditionFailedException('Organization not found');
    }
    const team: Team = await this.teamsService.getUniqueTeam(organization.id, teamName);
    if (!team) {
      throw new PreconditionFailedException('Team not found');
    }
    if (!token) {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        throw new PreconditionFailedException(`Report is not public`);
      }
    } else {
      const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id);
      const index: number = teams.findIndex((t: Team) => t.id === team.id);
      if (index === -1) {
        throw new ForbiddenException('You do not have permissions to access this report');
      }
    }
    const report: Report = await this.reportsService.getReport({ filter: { sluglified_name: reportName, team_id: team.id } });
    if (!report) {
      throw new PreconditionFailedException('Report not found');
    }
    await this.reportsService.increaseViews({ _id: new ObjectId(report.id) });
    report.views++;
    const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' });
    const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, null);
    return new NormalizedResponseDTO(reportDto, relations);
  }

  @Post('/kyso')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Create a new report sending the files`,
    description: `By passing the appropiate parameters you can create a new report referencing a git repository`,
  })
  @ApiBody({
    description: 'Update organization',
    required: true,
    type: CreateKysoReportDto,
    examples: CreateKysoReportDto.examples(),
  })
  @ApiResponse({
    status: 201,
    description: `Created report`,
    type: ReportDTO,
  })
  @FormDataRequest()
  @Permission([ReportPermissionsEnum.CREATE])
  async createKysoReport(
    @Headers(HEADER_X_KYSO_ORGANIZATION) organizationName: string,
    @Headers(HEADER_X_KYSO_TEAM) teamName: string,
    @CurrentToken() token: Token,
    @Body() createKysoReportDto: CreateKysoReportDto,
  ): Promise<NormalizedResponseDTO<Report | Report[]>> {
    Logger.log(`Called createKysoReport`);
    if (!createKysoReportDto.file) {
      throw new BadRequestException(`Missing file`);
    }
    const data: Report | Report[] = await this.reportsService.createKysoReport(token.id, createKysoReportDto, organizationName, teamName);
    if (Array.isArray(data)) {
      const reportDtos: ReportDTO[] = [];
      for (const report of data) {
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id);
        reportDtos.push(reportDto);
      }
      return new NormalizedResponseDTO(reportDtos);
    } else {
      const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(data, token.id);
      const relations = await this.relationsService.getRelations(data, 'report', { Author: 'User' });
      return new NormalizedResponseDTO(reportDto, relations);
    }
  }

  @Put('/kyso/:reportId')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Create a new report sending the files`,
    description: `By passing the appropiate parameters you can create a new report referencing a git repository`,
  })
  @ApiBody({
    description: 'Invite user to the organization',
    required: true,
    type: CreateKysoReportVersionDto,
    examples: CreateKysoReportVersionDto.examples(),
  })
  @ApiResponse({
    status: 201,
    description: `Create new version of report`,
    type: ReportDTO,
  })
  @FormDataRequest()
  @Permission([ReportPermissionsEnum.CREATE])
  async updateKysoReport(
    @CurrentToken() token: Token,
    @Param('reportId') reportId: string,
    @Body() createKysoReportVersionDto: CreateKysoReportVersionDto,
  ): Promise<NormalizedResponseDTO<Report | Report[]>> {
    Logger.log(`Called updateKysoReport`);
    const data: Report = await this.reportsService.updateKysoReport(token, reportId, createKysoReportVersionDto);
    const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(data, token.id);
    const relations = await this.relationsService.getRelations(data, 'report', { Author: 'User' });
    return new NormalizedResponseDTO(reportDto, relations);
  }

  @Post('/ui')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Create a new report sending the files`,
    description: `By passing the appropiate parameters you can create a new report referencing a git repository`,
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
    description: `Created report`,
    type: ReportDTO,
  })
  @UseInterceptors(FileInterceptor('file'))
  @Permission([ReportPermissionsEnum.CREATE])
  async createUIReport(@CurrentToken() token: Token, @UploadedFile() file: Express.Multer.File): Promise<NormalizedResponseDTO<Report>> {
    Logger.log(`Called createUIReport`);
    const report: Report = await this.reportsService.createUIReport(token.id, file, null, null);
    const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id);
    const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' });
    return new NormalizedResponseDTO(reportDto, relations);
  }

  @Post('/ui/main-file/:reportId')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Update the main file of the report`,
    description: `By passing the appropiate parameters you can update the main file of report`,
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
    description: `Update the main file of the report`,
    type: ReportDTO,
  })
  @UseInterceptors(FileInterceptor('file'))
  @Permission([ReportPermissionsEnum.EDIT])
  async updateMainFileReport(@CurrentToken() token: Token, @Param('reportId') reportId: string, @UploadedFile() file: Express.Multer.File): Promise<NormalizedResponseDTO<Report>> {
    const report: Report = await this.reportsService.updateMainFileReport(token.id, reportId, file, null, null);
    const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id);
    const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' });
    return new NormalizedResponseDTO(reportDto, relations);
  }

  @Post('/github/:repositoryName')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Create a new report based on github repository`,
    description: `By passing the appropiate parameters you can create a new report referencing a github repository`,
  })
  @ApiResponse({
    status: 201,
    description: `Created report`,
    type: ReportDTO,
  })
  async createReportFromGithubRepository(
    @CurrentToken() token: Token,
    @Param('repositoryName') repositoryName: string,
    @Query('branch') branch: string,
  ): Promise<NormalizedResponseDTO<Report | Report[]>> {
    Logger.log(`Called createReportFromGithubRepository`);
    const data: Report | Report[] = await this.reportsService.createReportFromGithubRepository(token, repositoryName, branch);
    if (Array.isArray(data)) {
      const reportDtos: ReportDTO[] = [];
      for (const report of data) {
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id);
        reportDtos.push(reportDto);
      }
      return new NormalizedResponseDTO(reportDtos);
    } else {
      const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(data, token.id);
      const relations = await this.relationsService.getRelations(data, 'report', { Author: 'User' });
      return new NormalizedResponseDTO(reportDto, relations);
    }
  }

  @Post('/bitbucket')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Create a new report based on bitbucket repository`,
    description: `By passing the appropiate parameters you can create a new report referencing a bitbucket repository`,
  })
  @ApiResponse({
    status: 201,
    description: `Created report`,
    type: ReportDTO,
  })
  async createReportFromBitbucketRepository(@CurrentToken() token: Token, @Query('name') name: string, @Query('branch') branch: string): Promise<NormalizedResponseDTO<Report | Report[]>> {
    if (!name || name.length === 0) {
      throw new PreconditionFailedException('Repository name is required');
    }
    Logger.log(`Called createReportFromBitbucketRepository`);
    const data: Report | Report[] = await this.reportsService.createReportFromBitbucketRepository(token, name, branch);
    if (Array.isArray(data)) {
      const reportDtos: ReportDTO[] = [];
      for (const report of data) {
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id);
        reportDtos.push(reportDto);
      }
      return new NormalizedResponseDTO(reportDtos);
    } else {
      const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(data, token.id);
      const relations = await this.relationsService.getRelations(data, 'report', { Author: 'User' });
      return new NormalizedResponseDTO(reportDto, relations);
    }
  }

  @Post('/gitlab')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Create a new report based on gitlab repository`,
    description: `By passing the appropiate parameters you can create a new report referencing a gitlab repository`,
  })
  @ApiResponse({
    status: 201,
    description: `Created report`,
    type: ReportDTO,
  })
  async createReportFromGitlabRepository(@CurrentToken() token: Token, @Query('id') id: string, @Query('branch') branch: string): Promise<NormalizedResponseDTO<Report | Report[]>> {
    Logger.log(`Called createReportFromGitlabRepository`);
    const data: Report | Report[] = await this.reportsService.createReportFromGitlabRepository(token, id, branch);
    if (Array.isArray(data)) {
      const reportDtos: ReportDTO[] = [];
      for (const report of data) {
        const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id);
        reportDtos.push(reportDto);
      }
      return new NormalizedResponseDTO(reportDtos);
    } else {
      const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(data, token.id);
      const relations = await this.relationsService.getRelations(data, 'report', { Author: 'User' });
      return new NormalizedResponseDTO(reportDto, relations);
    }
  }

  @Patch('/:reportId')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Update the specific report`,
    description: `Allows updating content from the specified report`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Specified report data`,
    type: ReportDTO,
  })
  @ApiBody({
    description: 'Update report data',
    required: true,
    type: UpdateReportRequestDTO,
    examples: UpdateReportRequestDTO.examples(),
  })
  @ApiParam({
    name: 'reportId',
    required: true,
    description: 'Id of the report to update',
    schema: { type: 'string' },
  })
  @ApiBody({ type: UpdateReportRequestDTO })
  @Permission([ReportPermissionsEnum.EDIT, ReportPermissionsEnum.EDIT_ONLY_MINE])
  async updateReport(@CurrentToken() token: Token, @Param('reportId') reportId: string, @Body() updateReportRequestDTO: UpdateReportRequestDTO): Promise<NormalizedResponseDTO<ReportDTO>> {
    Logger.log(`Called updateReport`);
    const report: Report = await this.reportsService.updateReport(token, reportId, updateReportRequestDTO);
    const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id);
    const relations = await this.relationsService.getRelations(reportDto, 'report', { Author: 'User' });
    return new NormalizedResponseDTO(report, relations);
  }

  @Delete('/:reportId')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Delete a report`,
    description: `Allows deleting a specific report using its {reportId}`,
  })
  @ApiResponse({ status: 200, description: `Report deleted successfully` })
  @ApiParam({
    name: 'reportId',
    required: true,
    description: 'Id of the report to fetch',
    schema: { type: 'string' },
  })
  @Permission([ReportPermissionsEnum.DELETE])
  async deleteReport(@CurrentToken() token: Token, @Param('reportId') reportId: string): Promise<NormalizedResponseDTO<Report>> {
    await this.checkIfUserCanExecuteActionInReport(token, reportId);
    const deletedReport: Report = await this.reportsService.deleteReport(token, reportId, true);
    return new NormalizedResponseDTO(deletedReport);
  }

  @Patch('/:reportId/pin')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Toggles global pin for the specified report`,
    description: `Allows pinning and unpinning of the specified report globally`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Specified report data`,
    type: Report,
  })
  @ApiParam({
    name: 'reportId',
    required: true,
    description: 'Id of the report to toggle global pin',
    schema: { type: 'string' },
  })
  @Permission([ReportPermissionsEnum.GLOBAL_PIN])
  async toggleGlobalPin(@CurrentToken() token: Token, @Param('reportId') reportId: string): Promise<NormalizedResponseDTO<Report>> {
    const report: Report = await this.reportsService.toggleGlobalPin(token, reportId);
    const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id);
    const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' });
    return new NormalizedResponseDTO(reportDto, relations);
  }

  @Patch('/:reportId/user-pin')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Toggles the user's pin the specified report`,
    description: `Allows pinning and unpinning of the specified report for a user`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Specified report data`,
    type: Report,
  })
  @ApiParam({
    name: 'reportId',
    required: true,
    description: 'Id of the report to pin',
    schema: { type: 'string' },
  })
  async toggleUserPin(@CurrentToken() token: Token, @Param('reportId') reportId: string): Promise<NormalizedResponseDTO<Report>> {
    const report: Report = await this.reportsService.toggleUserPin(token, reportId);
    const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id);
    const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' });
    return new NormalizedResponseDTO(reportDto, relations);
  }

  @Patch('/:reportId/user-star')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Toggles the user's star of the specified report`,
    description: `Allows starring and unstarring the specified report for a user`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Specified report data`,
    type: Report,
  })
  @ApiParam({
    name: 'reportId',
    required: true,
    description: 'Id of the report to pin',
    schema: { type: 'string' },
  })
  async toggleUserStar(@CurrentToken() token: Token, @Param('reportId') reportId: string): Promise<NormalizedResponseDTO<Report>> {
    const report: Report = await this.reportsService.toggleUserStar(token, reportId);
    const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id);
    const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' });
    return new NormalizedResponseDTO(reportDto, relations);
  }

  @Get('/:reportName/:teamName/pull')
  @Public()
  @ApiOperation({
    summary: `Pull a report from SCS`,
    description: `Pull a report from SCS. This will download all files from SCS in zip format.`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Zip file containing all files of the report`,
    type: Buffer,
  })
  @ApiParam({
    name: 'reportName',
    required: true,
    description: 'Id of the report to pull',
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'teamName',
    required: true,
    description: 'Id of the team to pull',
    schema: { type: 'string' },
  })
  async pullReport(
    @Headers(HEADER_X_KYSO_ORGANIZATION) organizationName: string,
    @Headers(HEADER_X_KYSO_TEAM) teamName: string,
    @CurrentToken() token: Token,
    @Param('reportName') reportName: string,
    @Param('teamName') teamNameParam: string,
    @Query('version') versionStr: string,
    @Req() request: any,
    @Res() response: any,
  ) {
    Logger.log('Pulling report');
    const organization: Organization = await this.organizationsService.getOrganizationBySlugName(organizationName);
    if (!organization) {
      Logger.error(`Organization ${organizationName} not found`);
      throw new NotFoundException('Organization not found');
    }
    const team: Team = await this.teamsService.getUniqueTeam(organization.id, teamName);
    if (!team) {
      Logger.error(`Team ${teamName} not found`);
      throw new NotFoundException('Team not found');
    }

    const report: Report = await this.reportsService.getReport({ filter: { sluglified_name: reportName, team_id: team.id } });
    if (!report) {
      Logger.error(`Report ${reportName} not found`);
      throw new NotFoundException('Report not found');
    }

    if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
      if (token) {
        const hasPermissions: boolean = AuthService.hasPermissions(token, [ReportPermissionsEnum.READ], team, organization);
        if (!hasPermissions) {
          throw new ForbiddenException('You do not have permissions to access this report');
        }
        await this.emailVerifiedGuard.validate(request);
        await this.solvedCaptchaGuard.validate(request);
      } else {
        throw new ForbiddenException('You do not have permissions to access this report');
      }
    }

    const downloadable: boolean = await this.reportsService.isReportDownloadable(token, organization, team);
    if (!downloadable) {
      throw new ForbiddenException('The report cannot be downloaded');
    }

    let version: number | null = null;
    if (versionStr) {
      try {
        version = parseInt(versionStr, 10);
      } catch (e) {
        Logger.error(`An error occurred while parsing the version`, e, ReportsController.name);
      }
    }
    NATSHelper.safelyEmit<KysoAnalyticsReportDownload>(this.client, KysoEventEnum.ANALYTICS_REPORT_DOWNLOAD, {
      report_id: report.id,
      user_id: token ? token.id : null,
      source: AnalyticsSource.CLI,
    });
    this.reportsService.returnZippedReport(report, version, response);
  }

  @Get('/:reportId/download')
  // @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Download a report from SCS`,
    description: `Download a report from SCS. This will download all files from SCS in zip format.`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Zip file containing all files of the report`,
    type: Buffer,
  })
  @ApiParam({
    name: 'reportId',
    required: true,
    description: 'Id of the report to pull',
    schema: { type: 'string' },
  })
  @Public()
  async downloadReport(@CurrentToken() token: Token, @Param('reportId') reportId: string, @Query('version') versionStr: string, @Req() request: any, @Res() response: any): Promise<any> {
    const report: Report = await this.reportsService.getReportById(reportId);
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    const team: Team = await this.teamsService.getTeamById(report.team_id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
    if (!organization) {
      throw new NotFoundException(`Organization with id ${team.organization_id} not found`);
    }

    if (token) {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        const hasPermissions: boolean = AuthService.hasPermissions(token, [ReportPermissionsEnum.READ], team, organization);
        if (!hasPermissions) {
          throw new ForbiddenException('You do not have permissions to access this report');
        }
      }
      await this.emailVerifiedGuard.validate(request);
      await this.solvedCaptchaGuard.validate(request);
    } else {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        throw new ForbiddenException('You do not have permissions to access this report');
      }
    }

    const downloadable: boolean = await this.reportsService.isReportDownloadable(token, organization, team);
    if (!downloadable) {
      throw new ForbiddenException('The report cannot be downloaded');
    }

    let version: number | null = null;
    if (versionStr) {
      try {
        version = parseInt(versionStr, 10);
      } catch (e) {
        Logger.error(`An error occurred while parsing the version`, e, ReportsController.name);
      }
    }
    NATSHelper.safelyEmit<KysoAnalyticsReportDownload>(this.client, KysoEventEnum.ANALYTICS_REPORT_DOWNLOAD, {
      report_id: report.id,
      user_id: token ? token.id : null,
      source: AnalyticsSource.UI,
    });
    this.reportsService.downloadReport(reportId, version, response);
  }

  @Get('/:reportId/files')
  @ApiOperation({
    summary: `Get all files of a report`,
    description: `Get all files of a report`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Specified report data`,
    type: File,
  })
  @ApiParam({
    name: 'reportId',
    required: true,
    description: 'Id of the report to fetch',
    schema: { type: 'string' },
  })
  @Public()
  async getReportFiles(@CurrentToken() token: Token, @Param('reportId') reportId: string, @Query('version') versionStr: string): Promise<NormalizedResponseDTO<File>> {
    const { team, organization } = await this.getReportTeamAndOrganizationGivenReportId(reportId);
    if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
      const hasPermissions: boolean = AuthService.hasPermissions(token, [ReportPermissionsEnum.READ], team, organization);
      if (!hasPermissions) {
        throw new ForbiddenException('You do not have permissions to access this report');
      }
    }
    let version: number | null = 0;
    if (versionStr && !isNaN(versionStr as any)) {
      version = parseInt(versionStr, 10);
    }
    const files: File[] = await this.reportsService.getReportFiles(reportId, version);
    return new NormalizedResponseDTO(files);
  }

  @Get('/:reportId/file-versions')
  @ApiOperation({
    summary: `Get all versions of a file in a report`,
    description: `Get all versions of a file in a report`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Specified report data`,
    type: File,
    isArray: true,
  })
  @ApiParam({
    name: 'reportId',
    required: true,
    description: 'Id of the report to fetch',
    schema: { type: 'string' },
  })
  @ApiQuery({
    name: 'fileName',
    required: true,
    description: 'Name of the file to fetch',
    schema: { type: 'string' },
  })
  @Public()
  async getFileVersions(@CurrentToken() token: Token, @Param('reportId') reportId: string, @Query('fileName') fileName: string): Promise<NormalizedResponseDTO<any>> {
    if (!fileName) {
      throw new BadRequestException('fileName is required');
    }
    const { team, organization } = await this.getReportTeamAndOrganizationGivenReportId(reportId);
    if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
      const hasPermissions: boolean = AuthService.hasPermissions(token, [ReportPermissionsEnum.READ], team, organization);
      if (!hasPermissions) {
        throw new ForbiddenException('You do not have permissions to access this report');
      }
    }
    const files: File[] = await this.reportsService.getFileVersions(reportId, fileName);
    return new NormalizedResponseDTO(files);
  }

  @Get('/:reportId/versions')
  @ApiOperation({
    summary: `Get all versions of a report`,
    description: `Get all versions of a report`,
  })
  @ApiParam({
    name: 'reportId',
    required: true,
    description: 'Id of the report to fetch',
    schema: { type: 'string' },
  })
  @Public()
  async getReportVersions(
    @CurrentToken() token: Token,
    @Param('reportId') reportId: string,
    @Req() req,
  ): Promise<NormalizedResponseDTO<{ version: number; created_at: Date; num_files: number; message: string; git_commit: GitCommit }>> {
    const report: Report = await this.reportsService.getReportById(reportId);
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    const team: Team = await this.teamsService.getTeamById(report.team_id);
    if (!team) {
      throw new NotFoundException(`Team with id ${report.team_id} not found`);
    }
    if (token) {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        const index: number = token.permissions.teams.findIndex((t: ResourcePermissions) => t.id === team.id);
        if (index === -1) {
          throw new ForbiddenException('You do not have permissions to access this report');
        }
      }
    } else {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        throw new ForbiddenException('You do not have permissions to access this report');
      }
    }
    const query = QueryParser.toQueryObject(req.url);
    if (!query.sort) {
      query.sort = { created_at: -1 };
    }
    const versions: { version: number; created_at: Date; num_files: number; message: string }[] = await this.reportsService.getReportVersions(reportId);
    if (query.sort.created_at === 1) {
      versions.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
    } else {
      versions.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    }
    return new NormalizedResponseDTO(versions);
  }

  @Get('/:reportId/tree')
  @ApiOperation({
    summary: `Explore a report tree`,
    description: `Get hash of a file for a given report. If the file is a folder, will get information about the files in it too (non-recursively). Path is currently ignored for local reports.`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Content of the requested file`,
    type: String,
  })
  @ApiParam({
    name: 'reportId',
    required: true,
    description: 'Id of the report to fetch',
    schema: { type: 'string' },
  })
  async getReportTree(
    @CurrentToken() token: Token,
    @Param('reportId') reportId: string,
    @Query('path') path: string,
    @Query('version') versionStr: string,
  ): Promise<NormalizedResponseDTO<GithubFileHash | GithubFileHash[]>> {
    const report: Report = await this.reportsService.getReportById(reportId);
    if (!report) {
      throw new PreconditionFailedException('Report not found');
    }
    const team: Team = await this.teamsService.getTeamById(report.team_id);

    if (!team) {
      throw new NotFoundException(`Team with id ${report.team_id} not found`);
    }

    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
    if (!organization) {
      throw new NotFoundException(`Organization with id ${team.organization_id} not found`);
    }

    if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
      const hasPermissions: boolean = AuthService.hasPermissions(token, [ReportPermissionsEnum.READ], team, organization);
      if (!hasPermissions) {
        throw new ForbiddenException('You do not have permissions to access this report');
      }
    }
    let version: number | null;
    if (versionStr && !isNaN(Number(versionStr))) {
      version = parseInt(versionStr, 10);
    }
    const hash: GithubFileHash | GithubFileHash[] = await this.reportsService.getReportTree(reportId, path, version);
    return new NormalizedResponseDTO(hash);
  }

  @Get('/file-content/:id')
  @Public()
  @ApiOperation({
    summary: `Get content of a file`,
    description: `By passing the id a file, get its raw content directly from the source.`,
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Id of the report to fetch',
    schema: { type: 'string' },
  })
  async getReportFileContent(@CurrentToken() token: Token, @Param('id') id: string): Promise<Buffer> {
    const file: File = await this.reportsService.getFileById(id);
    if (!file) {
      throw new PreconditionFailedException('File not found');
    }
    const report: Report = await this.reportsService.getReportById(file.report_id);
    if (!report) {
      throw new PreconditionFailedException('Report not found');
    }
    const team: Team = await this.teamsService.getTeamById(report.team_id);
    if (!token) {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        throw new PreconditionFailedException(`Report is not public`);
      }
    } else {
      const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id);
      const index: number = teams.findIndex((t: Team) => t.id === team.id);
      if (index === -1) {
        throw new ForbiddenException('You do not have permissions to access this report');
      }
    }
    return this.reportsService.getReportFileContent(file);
  }

  @Get('/file/:id')
  @Public()
  @ApiOperation({
    summary: `Get file info`,
    description: `By passing the id a file, get its metadata.`,
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Id of the file to fetch',
    schema: { type: 'string' },
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Report`,
    type: File,
  })
  async getReportFile(@CurrentToken() token: Token, @Param('id') id: string): Promise<NormalizedResponseDTO<File>> {
    const file: File = await this.reportsService.getFileById(id);
    if (!file) {
      throw new PreconditionFailedException('File not found');
    }
    const report: Report = await this.reportsService.getReportById(file.report_id);
    if (!report) {
      throw new PreconditionFailedException('Report not found');
    }
    const team: Team = await this.teamsService.getTeamById(report.team_id);
    if (!token) {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        throw new PreconditionFailedException(`Report is not public`);
      }
    } else {
      const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id);
      const index: number = teams.findIndex((t: Team) => t.id === team.id);
      if (index === -1) {
        throw new ForbiddenException('You do not have permissions to access this report');
      }
    }
    return new NormalizedResponseDTO(file);
  }

  @Get('/:teamId/:reportSlug')
  @ApiOperation({
    summary: `Get a report given team id and report slug`,
    description: `Allows fetching content of a specific report passing team id and its slug`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Report`,
    type: ReportDTO,
  })
  @ApiParam({
    name: 'teamId',
    required: true,
    description: 'Id of the team to which the report belongs',
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'reportSlug',
    required: true,
    description: 'Slug the report to fetch',
    schema: { type: 'string' },
  })
  @Public()
  async getReport(
    @CurrentToken() token: Token,
    @Req() request: Request,
    @RealIP() realIp: string,
    @Param('teamId') teamId: string,
    @Param('reportSlug') reportSlug: string,
    @Query('version') versionStr: string,
  ): Promise<NormalizedResponseDTO<ReportDTO>> {
    const team: Team = await this.teamsService.getTeamById(teamId);
    if (!team) {
      throw new NotFoundException(`Team with id ${teamId} not found`);
    }
    if (token) {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        const index: number = token.permissions.teams.findIndex((t: ResourcePermissions) => t.id === teamId);
        if (index === -1) {
          throw new ForbiddenException('You do not have permissions to access this report');
        }
      }
    } else {
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        throw new ForbiddenException('You do not have permissions to access this report');
      }
    }
    const report: Report = await this.reportsService.getReport({
      filter: {
        team_id: teamId,
        sluglified_name: reportSlug,
      },
    });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    let version: number | null = null;
    if (versionStr && !isNaN(Number(versionStr))) {
      version = parseInt(versionStr, 10);
    }
    await this.reportsService.increaseViews({ _id: new ObjectId(report.id) });
    report.views += 1;
    const user_id: string | null = token ? token.id : null;
    const user_agent: string = request.headers['user-agent'] || null;
    if (ipaddr.isValid(realIp)) {
      const addr: any = ipaddr.parse(realIp);
      if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
        realIp = addr.toIPv4Address().toString();
      }
    }
    this.reportsService.sendReportViewEvent(report.id, user_id, realIp, user_agent);
    const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' });
    const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token?.id, version);
    return new NormalizedResponseDTO(reportDto, relations);
  }

  @Post('/:reportId/on-shared')
  @ApiOperation({
    summary: `Detect if a report is shared`,
    description: `Allows detecting if a report is shared passing its id`,
  })
  @ApiParam({
    name: 'reportId',
    required: true,
    description: `Id of the report to fetch`,
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: `Report shared`,
  })
  @ApiResponse({
    status: 404,
    description: `Report not found`,
  })
  @Public()
  async onShareReport(@CurrentToken() token: Token, @Param('reportId') reportId: string): Promise<void> {
    const report: Report = await this.reportsService.getReportById(reportId);
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    NATSHelper.safelyEmit<KysoAnalyticsReportShare>(this.client, KysoEventEnum.ANALYTICS_REPORT_SHARE, {
      report_id: report.id,
      user_id: token ? token.id : null,
    });
  }

  @UseInterceptors(FileInterceptor('file'))
  @Post('/:reportId/preview-picture')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Upload a profile picture for a report`,
    description: `Allows uploading a profile picture for a report passing its id and image`,
  })
  @ApiParam({
    name: 'reportId',
    required: true,
    description: `Id of the report to fetch`,
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
  @ApiNormalizedResponse({ status: 201, description: `Updated report`, type: ReportDTO })
  @Permission([ReportPermissionsEnum.EDIT])
  public async setProfilePicture(@CurrentToken() token: Token, @Param('reportId') reportId: string, @UploadedFile() file: Express.Multer.File): Promise<NormalizedResponseDTO<ReportDTO>> {
    await this.checkIfUserCanExecuteActionInReport(token, reportId);
    if (!file) {
      throw new BadRequestException(`Missing file`);
    }
    if (file.mimetype.split('/')[0] !== 'image') {
      throw new BadRequestException(`Only image files are allowed`);
    }
    const updatedReport: Report = await this.reportsService.setPreviewPicture(reportId, file);
    const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(updatedReport, token.id);
    const relations = await this.relationsService.getRelations(updatedReport, 'report', { Author: 'User' });
    return new NormalizedResponseDTO(reportDto, relations);
  }

  @Delete('/:reportId/preview-picture')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Delete a profile picture for a report`,
    description: `Allows deleting a profile picture for a report passing its id`,
  })
  @ApiParam({
    name: 'reportId',
    required: true,
    description: `Id of the report to fetch`,
    schema: { type: 'string' },
  })
  @Permission([ReportPermissionsEnum.EDIT])
  @ApiNormalizedResponse({ status: 200, description: `Updated report`, type: ReportDTO })
  public async deleteBackgroundImage(@CurrentToken() token: Token, @Param('reportId') reportId: string): Promise<NormalizedResponseDTO<ReportDTO>> {
    await this.checkIfUserCanExecuteActionInReport(token, reportId);
    const updatedReport: Report = await this.reportsService.deletePreviewPicture(reportId);
    const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(updatedReport, token.id);
    const relations = await this.relationsService.getRelations(updatedReport, 'report', { Author: 'User' });
    return new NormalizedResponseDTO(reportDto, relations);
  }

  @Get('/:reportName/:teamName')
  @ApiOperation({
    summary: `Get a report`,
    description: `Allows fetching content of a specific report passing its name and team name`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Report matching name and team name`,
    type: ReportDTO,
  })
  @ApiParam({
    name: 'reportName',
    required: true,
    description: 'Name of the report to fetch',
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'teamName',
    required: true,
    description: 'Name of the team to fetch',
    schema: { type: 'string' },
  })
  async getReportByName(
    @Headers(HEADER_X_KYSO_ORGANIZATION) organizationName: string,
    @CurrentToken() token: Token,
    @Param('reportName') reportName: string,
    @Param('teamName') teamNameParam: string,
  ): Promise<NormalizedResponseDTO<ReportDTO>> {
    const organization: Organization = await this.organizationsService.getOrganization({ filter: { sluglified_name: organizationName } });
    if (!organization) {
      throw new PreconditionFailedException('Organization not found');
    }
    const report: Report = await this.reportsService.getReportByName(reportName, teamNameParam, organization.id);
    const team: Team = await this.teamsService.getTeamById(report.team_id);
    if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
      const hasPermissions: boolean = AuthService.hasPermissions(token, [ReportPermissionsEnum.READ], team, organization);
      if (!hasPermissions) {
        throw new ForbiddenException('You do not have permissions to access this report');
      }
    }
    const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' });
    const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id);
    return new NormalizedResponseDTO(reportDto, relations);
  }

  // Draft reports
  @Get('/ui/draft')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Get a report draft of the invoker user`,
    description: `By passing the appropiate parameters you can retrieve a new report draft`,
  })
  @ApiResponse({
    status: 201,
    description: `Created report`,
    type: DraftReport,
  })
  @Permission([ReportPermissionsEnum.READ])
  async getDraftReport(@CurrentToken() token: Token, @Query('org_id') organizationId: string, @Query('team_id') teamId: string): Promise<NormalizedResponseDTO<DraftReport>> {
    const draft: DraftReport = await this.reportsService.getDraft(organizationId, teamId, token.id);
    const relations = await this.relationsService.getRelations(draft, 'report', { Author: 'User', Team: 'Team', Organization: 'Organization' });

    return new NormalizedResponseDTO(draft, relations);
  }

  @Post('/ui/draft')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Create a new report draft`,
    description: `By passing the appropiate parameters you can create a new report draft`,
  })
  @ApiResponse({
    status: 201,
    description: `Created report`,
    type: DraftReport,
  })
  @ApiBody({
    description: 'Examples',
    required: true,
    type: DraftReport,
    examples: DraftReport.examples(),
  })
  @Permission([ReportPermissionsEnum.CREATE])
  async createUIDraftReport(@CurrentToken() token: Token, @Body() draftReport: DraftReport): Promise<NormalizedResponseDTO<DraftReport>> {
    Logger.log(`Creating draft report`);

    if (token.id !== draftReport.creator_user_id) {
      throw new ForbiddenException('Requester does not march with creator_user_id');
      // SEC-AUDIT
    }

    const draft: DraftReport = await this.reportsService.createDraftReport(draftReport);
    const relations = await this.relationsService.getRelations(draft, 'report', { Author: 'User', Team: 'Team', Organization: 'Organization' });

    return new NormalizedResponseDTO(draft, relations);
  }

  @Post('move')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Move a report to another channel`,
    description: `By passing the appropiate parameters you can move a report to another channel`,
  })
  @ApiResponse({
    status: 201,
    description: `Moved report`,
    type: ReportDTO,
  })
  public async moveReport(@CurrentToken() token: Token, @Body() moveReportDto: MoveReportDto): Promise<NormalizedResponseDTO<ReportDTO>> {
    const report: Report = await this.reportsService.moveReport(token, moveReportDto);
    const reportDto: ReportDTO = await this.reportsService.reportModelToReportDTO(report, token.id);
    const relations = await this.relationsService.getRelations(report, 'report', { Author: 'User' });
    return new NormalizedResponseDTO(reportDto, relations);
  }

  @Post('/import/office/s3')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Imports from S3 bucket Office documents based on its metadata`,
    description: `By passing the appropiate parameters you can import a bunch of reports`,
  })
  @Permission([ReportPermissionsEnum.CREATE])
  async importOfficeFromS3(@Body() data: any): Promise<NormalizedResponseDTO<any>> {
    const allSettings: KysoSetting[] = await this.kysoSettingsService.getAll();

    const webhookUrl = allSettings.find((x: KysoSetting) => x.key === KysoSettingsEnum.KYSO_WEBHOOK_URL);

    if (webhookUrl) {
      const httpClient = axios.create({
        baseURL: webhookUrl.value,
        headers: {
          'Content-Type': 'application/json',
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      const url = `/hooks/s3import`;
      const axiosResponse: AxiosResponse<any> = await httpClient.post(url, data);

      return axiosResponse.data;
    } else {
      throw new PreconditionFailedException('Webhook URL not found. Review Kyso Settings');
    }
  }

  private async getNormalizedResponsePaginatedReports(token: Token, data: any): Promise<NormalizedResponseDTO<PaginatedResponseDto<ReportDTO>>> {
    const paginatedResponseDto: PaginatedResponseDto<ReportDTO> = new PaginatedResponseDto<ReportDTO>(0, 0, 0, [], 0, 0);
    paginatedResponseDto.totalItems = await this.reportsService.countReports({ filter: data.filter });
    paginatedResponseDto.totalPages = Math.ceil(paginatedResponseDto.totalItems / data.limit);
    paginatedResponseDto.currentPage = data.skip ? Math.floor(data.skip / data.limit) + 1 : 1;
    const reports: Report[] = await this.reportsService.getReports(data);
    paginatedResponseDto.results = await Promise.all(reports.map((report: Report) => this.reportsService.reportModelToReportDTO(report, token?.id)));
    paginatedResponseDto.itemCount = paginatedResponseDto.results.length;
    paginatedResponseDto.itemsPerPage = data.limit;
    const relations = await this.relationsService.getRelations(reports, 'report', { Author: 'User' });
    return new NormalizedResponseDTO(paginatedResponseDto, relations);
  }

  private async checkIfUserCanExecuteActionInReport(token: Token, reportId: string): Promise<void> {
    const { report, team, organization } = await this.getReportTeamAndOrganizationGivenReportId(reportId);
    const isOwner: boolean = await this.reportsService.isOwner(report.user_id, token.id);
    if (!isOwner) {
      const canExecuteAction: boolean = await this.reportsService.canExecuteAction(token, organization, team);
      if (!canExecuteAction) {
        throw new ForbiddenException('You can not delete this report');
      }
    }
  }

  private async getReportTeamAndOrganizationGivenReportId(reportId: string): Promise<{ report: Report; team: Team; organization: Organization }> {
    const report: Report = await this.reportsService.getReportById(reportId);
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    const team: Team = await this.teamsService.getTeamById(report.team_id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return { report, team, organization };
  }
}
