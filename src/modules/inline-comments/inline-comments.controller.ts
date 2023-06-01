import {
  CreateInlineCommentDto,
  HEADER_X_KYSO_ORGANIZATION,
  HEADER_X_KYSO_TEAM,
  InlineComment,
  InlineCommentDto,
  InlineCommentPermissionsEnum,
  InlineCommentStatusEnum,
  NormalizedResponseDTO,
  PaginatedResponseDto,
  Relations,
  Report,
  Team,
  TeamVisibilityEnum,
  Token,
  UpdateInlineCommentDto,
  User,
} from '@kyso-io/kyso-model';
import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as moment from 'moment';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
import { Autowired } from '../../decorators/autowired';
import { Public } from '../../decorators/is-public';
import { GenericController } from '../../generic/controller.generic';
import { Validators } from '../../helpers/validators';
import { db } from '../../main';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { Permission } from '../auth/annotations/permission.decorator';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { SolvedCaptchaGuard } from '../auth/guards/solved-captcha.guard';
import { RelationsService } from '../relations/relations.service';
import { ReportsService } from '../reports/reports.service';
import { TeamsService } from '../teams/teams.service';
import { UsersService } from '../users/users.service';
import { InlineCommentsService } from './inline-comments.service';
import { SearchInlineCommentsQuery } from './search-inline-comments-query';

@Controller('inline-comments')
@ApiTags('inline-comments')
@ApiExtraModels(InlineComment)
@UseGuards(PermissionsGuard)
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
export class InlineCommentController extends GenericController<InlineComment> {
  @Autowired({ typeName: 'RelationsService' })
  private relationsService: RelationsService;

  @Autowired({ typeName: 'ReportsService' })
  private reportsService: ReportsService;

  @Autowired({ typeName: 'TeamsService' })
  private teamsService: TeamsService;

  @Autowired({ typeName: 'UsersService' })
  private usersService: UsersService;

  constructor(private readonly inlineCommentsService: InlineCommentsService) {
    super();
  }

  @Get()
  @ApiOperation({
    summary: 'Get all inline comments for a report',
    description: 'Get all inline comments for a report',
  })
  @ApiQuery({
    name: 'report_id',
    required: true,
    description: 'Id of the report to fetch inline comments',
    schema: { type: 'string' },
  })
  @ApiQuery({
    name: 'file_id',
    required: false,
    description: 'Id of the file to fetch inline comments',
    schema: { type: 'string' },
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Report inline comments`,
    type: InlineCommentDto,
  })
  @Public()
  async getInlineComments(@CurrentToken() token: Token, @Query('reportId') report_id: string, @Query('file_id') file_id: string): Promise<NormalizedResponseDTO<InlineCommentDto[]>> {
    if (!report_id) {
      throw new BadRequestException('reportId is required');
    }
    const report: Report = await this.reportsService.getReportById(report_id);
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    const team: Team = await this.teamsService.getTeamById(report.team_id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
      if (!token) {
        throw new ForbiddenException('You are not authorized to access this resource');
      }
      const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id);
      const index: number = teams.findIndex((t: Team) => t.id === team.id);
      if (index === -1) {
        throw new ForbiddenException('You are not allowed to see comments of this report');
      }
    }
    const inlineComments: InlineComment[] = await this.inlineCommentsService.getGivenReportId(report_id, file_id);
    const relations: Relations = await this.relationsService.getRelations(inlineComments, 'InlineComment', { mentions: 'User' });
    const inlineCommentsDto: InlineCommentDto[] = await Promise.all(
      inlineComments.map((inlineComment: InlineComment) => this.inlineCommentsService.inlineCommentModelToInlineCommentDto(inlineComment)),
    );
    return new NormalizedResponseDTO(inlineCommentsDto, relations);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search inline comments',
    description: 'Search inline comments',
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Report inline comments`,
    type: PaginatedResponseDto<InlineCommentDto>,
  })
  public async searchInlineComments(
    @CurrentToken() token: Token,
    @Query() searchInlineCommentsQuery: SearchInlineCommentsQuery,
  ): Promise<NormalizedResponseDTO<PaginatedResponseDto<InlineCommentDto>>> {
    let teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id);
    if (searchInlineCommentsQuery.organization_id) {
      teams = teams.filter((team: Team) => team.organization_id === searchInlineCommentsQuery.organization_id);
    }
    if (searchInlineCommentsQuery.team_id) {
      teams = teams.filter((team: Team) => {
        if (searchInlineCommentsQuery.team_id_operator === 'eq') {
          return team.id === searchInlineCommentsQuery.team_id;
        } else {
          return team.id !== searchInlineCommentsQuery.team_id;
        }
      });
    }
    if (teams.length === 0) {
      const paginatedResponseDto: PaginatedResponseDto<InlineCommentDto> = new PaginatedResponseDto<InlineCommentDto>(1, 0, 0, [], 0, 0);
      return new NormalizedResponseDTO(paginatedResponseDto);
    }
    const filterReports = {
      team_id: { $in: teams.map((team: Team) => team.id) },
    };
    if (searchInlineCommentsQuery.report_author_id) {
      if (searchInlineCommentsQuery.report_author_id_operator === 'eq') {
        filterReports['author_ids'] = { $in: [searchInlineCommentsQuery.report_author_id] };
      } else {
        filterReports['author_ids'] = { $nin: [searchInlineCommentsQuery.report_author_id] };
      }
    } else {
      filterReports['author_ids'] = { $in: [token.id] };
    }
    const reports: Report[] = await this.reportsService.getReports({
      filter: filterReports,
    });
    if (reports.length === 0) {
      const paginatedResponseDto: PaginatedResponseDto<InlineCommentDto> = new PaginatedResponseDto<InlineCommentDto>(1, 0, 0, [], 0, 0);
      return new NormalizedResponseDTO(paginatedResponseDto);
    }
    const inlineCommentsQuery: any = {
      file_id: {
        $ne: null,
      },
      parent_comment_id: null,
      $or: [{ orphan: true }],
    };

    if (searchInlineCommentsQuery.inline_comment_author_id) {
      if (searchInlineCommentsQuery.inline_comment_author_id_operator === 'eq') {
        inlineCommentsQuery.user_id = searchInlineCommentsQuery.inline_comment_author_id;
      } else {
        inlineCommentsQuery.user_id = { $ne: searchInlineCommentsQuery.inline_comment_author_id };
      }
    } else {
      // If not set, by default look for inline comments in which the user is the author
      inlineCommentsQuery.$or.push({
        user_id: token.id,
      });
    }

    const report_versions: number[] = await Promise.all(reports.map((report: Report) => this.reportsService.getLastVersionOfReport(report.id)));
    reports.forEach((report: Report, index: number) => {
      inlineCommentsQuery.$or.push({
        report_id: report.id,
        report_version: report_versions[index],
      });
    });
    if (searchInlineCommentsQuery.status && searchInlineCommentsQuery.status.length > 0) {
      inlineCommentsQuery.current_status = {
        [`$${searchInlineCommentsQuery.status_operator}`]: searchInlineCommentsQuery.status,
      };
    }
    if (searchInlineCommentsQuery.text) {
      inlineCommentsQuery.$text = { $search: searchInlineCommentsQuery.text };
    }
    if (searchInlineCommentsQuery.start_date || searchInlineCommentsQuery.end_date) {
      inlineCommentsQuery.created_at = {};
      if (searchInlineCommentsQuery.start_date) {
        inlineCommentsQuery.created_at[`$${searchInlineCommentsQuery.start_date_operator}`] = moment(searchInlineCommentsQuery.start_date, 'YYYY-MM-DD', true).toDate();
      }
      if (searchInlineCommentsQuery.end_date) {
        inlineCommentsQuery.created_at[`$${searchInlineCommentsQuery.end_date_operator}`] = moment(searchInlineCommentsQuery.end_date, 'YYYY-MM-DD', true).toDate();
      }
    }

    console.log(inlineCommentsQuery);

    const inlineComments: InlineComment[] = await db
      .collection('InlineComment')
      .find(inlineCommentsQuery)
      .limit(searchInlineCommentsQuery.limit)
      .skip((searchInlineCommentsQuery.page - 1) * searchInlineCommentsQuery.limit)
      .sort({
        [searchInlineCommentsQuery.order_by]: searchInlineCommentsQuery.order_direction === 'asc' ? 1 : -1,
      })
      .toArray();

    const relations: Relations = await this.relationsService.getRelations(inlineComments, 'InlineComment', { mentions: 'User' });
    const usersRelatedToReports = [];

    if (relations.report) {
      for (const reportId in relations.report) {
        if (relations.report.hasOwnProperty(reportId)) {
          const authorIds = (relations.report[reportId] as Report)?.author_ids;

          if (authorIds) {
            usersRelatedToReports.push(...(relations.report[reportId] as Report)?.author_ids);
          }
          relations.report[reportId] = await this.reportsService.reportModelToReportDTO(relations.report[reportId], token.id);
        }
      }
    }

    // ADD MISSING RELATIONS TO USER AUTHORS
    let userRelationKeys = [];
    if (relations.user) {
      userRelationKeys = Object.keys(relations.user);
    }

    for (const userId of usersRelatedToReports) {
      if (userRelationKeys.findIndex((x) => x === userId) === -1) {
        // The user does not exists in the relations, add it
        const missingUser: User = await this.usersService.getUserById(userId);
        delete missingUser.hashed_password;
        relations.user[userId] = missingUser;
      }
    }

    const inlineCommentsDto: InlineCommentDto[] = await Promise.all(
      inlineComments.map((inlineComment: InlineComment) => this.inlineCommentsService.inlineCommentModelToInlineCommentDto(inlineComment)),
    );

    const totalItems: number = await this.inlineCommentsService.countInlineComments({ filter: inlineCommentsQuery });
    const totalPages: number = totalItems > 0 ? Math.ceil(totalItems / searchInlineCommentsQuery.limit) : 0;
    const paginatedResponseDto: PaginatedResponseDto<InlineCommentDto> = new PaginatedResponseDto<InlineCommentDto>(
      searchInlineCommentsQuery.page,
      inlineCommentsDto.length,
      searchInlineCommentsQuery.limit,
      inlineCommentsDto,
      totalItems,
      totalPages,
    );
    return new NormalizedResponseDTO(paginatedResponseDto, relations);
  }

  @Get('count-opened')
  @ApiOperation({
    summary: `Count opened inline comments`,
    description: `Count opened inline comments`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Count opened inline comments`,
    type: Number,
  })
  public async countOpenedInlineComments(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<number>> {
    const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id);

    if (teams.length === 0) {
      const paginatedResponseDto: PaginatedResponseDto<InlineCommentDto> = new PaginatedResponseDto<InlineCommentDto>(1, 0, 0, [], 0, 0);
      return new NormalizedResponseDTO(paginatedResponseDto.totalItems);
    }

    const filterReports = {
      team_id: { $in: teams.map((team: Team) => team.id) },
      author_ids: { $in: [token.id] },
    };

    const reports: Report[] = await this.reportsService.getReports({
      filter: filterReports,
    });

    if (reports.length === 0) {
      const paginatedResponseDto: PaginatedResponseDto<InlineCommentDto> = new PaginatedResponseDto<InlineCommentDto>(1, 0, 0, [], 0, 0);
      return new NormalizedResponseDTO(paginatedResponseDto.totalItems);
    }

    const inlineCommentsQuery: any = {
      file_id: {
        $ne: null,
      },
      parent_comment_id: null,
      current_status: {
        $in: [InlineCommentStatusEnum.DOING, InlineCommentStatusEnum.OPEN, InlineCommentStatusEnum.TO_DO],
      },
      // $and: [{ user_id: token.id }],
      $or: [{ orphan: true }],
    };

    const report_versions: number[] = await Promise.all(reports.map((report: Report) => this.reportsService.getLastVersionOfReport(report.id)));

    reports.forEach((report: Report, index: number) => {
      inlineCommentsQuery.$or.push({
        report_id: report.id,
        report_version: report_versions[index],
      });
    });

    const totalItems: number = await this.inlineCommentsService.countInlineComments({ filter: inlineCommentsQuery });

    return new NormalizedResponseDTO(totalItems);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get inline comment',
    description: 'Get inline comment',
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Inline comment`,
    type: InlineCommentDto,
  })
  @ApiNormalizedResponse({
    status: 400,
    description: `Invalid inline comment id`,
    type: InlineCommentDto,
  })
  @ApiNormalizedResponse({
    status: 403,
    description: `You are not allowed to get this inline comment`,
    type: InlineCommentDto,
  })
  @ApiNormalizedResponse({
    status: 404,
    description: `Inline comment not found`,
    type: InlineCommentDto,
  })
  @ApiNormalizedResponse({
    status: 404,
    description: `Report not found`,
    type: InlineCommentDto,
  })
  @ApiNormalizedResponse({
    status: 404,
    description: `Team not found`,
    type: InlineCommentDto,
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Id of the inline comment',
    schema: { type: 'string' },
  })
  @Public()
  async getInlineComment(@CurrentToken() token: Token, @Param('id') id: string): Promise<NormalizedResponseDTO<InlineCommentDto>> {
    if (!Validators.isValidObjectId(id)) {
      throw new BadRequestException('Invalid inline comment id');
    }
    const inlineComment: InlineComment = await this.inlineCommentsService.getById(id);
    if (!inlineComment) {
      throw new NotFoundException('Inline comment not found');
    }
    const report: Report = await this.reportsService.getReportById(inlineComment.report_id);
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    const team: Team = await this.teamsService.getTeamById(report.team_id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
      if (!token) {
        throw new ForbiddenException('You are not allowed to get this inline comment');
      }
      const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id);
      const index: number = teams.findIndex((t: Team) => t.id === team.id);
      if (index === -1) {
        throw new ForbiddenException('You are not allowed to get this inline comment');
      }
    }
    const relations: Relations = await this.relationsService.getRelations(inlineComment, 'InlineComment', { mentions: 'User' });
    const inlineCommentDto: InlineCommentDto = await this.inlineCommentsService.inlineCommentModelToInlineCommentDto(inlineComment);
    for (const inlineCommentStatusHistoryDto of inlineComment.status_history) {
      if (!relations.user[inlineCommentStatusHistoryDto.user_id]) {
        const user: User = await this.usersService.getUserById(inlineCommentStatusHistoryDto.user_id);
        relations.user[user.id] = user;
      }
    }
    return new NormalizedResponseDTO(inlineCommentDto, relations);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new inline comment',
    description: 'Create a new inline comment',
  })
  @ApiBody({
    description: 'Create inline comment',
    required: true,
    type: CreateInlineCommentDto,
    examples: CreateInlineCommentDto.examples(),
  })
  @ApiNormalizedResponse({
    status: 200,
    description: 'Inline comment created',
    type: InlineCommentDto,
  })
  @Permission([InlineCommentPermissionsEnum.CREATE])
  async createInlineComment(@CurrentToken() token: Token, @Body() createInlineCommentDto: CreateInlineCommentDto): Promise<NormalizedResponseDTO<InlineCommentDto>> {
    const inlineComment: InlineComment = await this.inlineCommentsService.createInlineComment(token.id, createInlineCommentDto);
    const relations: Relations = await this.relationsService.getRelations(inlineComment, 'InlineComment', { mentions: 'User' });
    const inlineCommentDto: InlineCommentDto = await this.inlineCommentsService.inlineCommentModelToInlineCommentDto(inlineComment);
    return new NormalizedResponseDTO(inlineCommentDto, relations);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an inline comment',
    description: 'Update an inline comment',
  })
  @ApiBody({
    description: 'Update inline comment',
    required: true,
    type: UpdateInlineCommentDto,
    examples: UpdateInlineCommentDto.examples(),
  })
  @ApiNormalizedResponse({
    status: 200,
    description: 'Inline comment updated',
    type: InlineCommentDto,
  })
  @Permission([InlineCommentPermissionsEnum.EDIT])
  async updateInlineComment(@CurrentToken() token: Token, @Param('id') id: string, @Body() updateInlineCommentDto: UpdateInlineCommentDto): Promise<NormalizedResponseDTO<InlineCommentDto>> {
    const inlineComment: InlineComment = await this.inlineCommentsService.updateInlineComment(token, id, updateInlineCommentDto);
    const relations: Relations = await this.relationsService.getRelations(inlineComment, 'InlineComment', { mentions: 'User' });
    const inlineCommentDto: InlineCommentDto = await this.inlineCommentsService.inlineCommentModelToInlineCommentDto(inlineComment);
    return new NormalizedResponseDTO(inlineCommentDto, relations);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Delete an inline comment`,
    description: `Allows deleting an inline comment.`,
  })
  @ApiResponse({ status: 204, description: `Inline comment deleted`, type: Boolean })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Id of the inline comment to delete',
    schema: { type: 'string' },
  })
  @Permission([InlineCommentPermissionsEnum.DELETE])
  async delete(@CurrentToken() token: Token, @Param('id') id: string): Promise<NormalizedResponseDTO<boolean>> {
    const deleted: boolean = await this.inlineCommentsService.deleteInlineComment(token, id);
    return new NormalizedResponseDTO(deleted);
  }
}
