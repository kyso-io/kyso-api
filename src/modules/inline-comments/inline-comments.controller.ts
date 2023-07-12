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
import { Autowired } from '../../decorators/autowired';
import { Public } from '../../decorators/is-public';
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
export class InlineCommentController {
  @Autowired({ typeName: 'RelationsService' })
  private relationsService: RelationsService;

  @Autowired({ typeName: 'ReportsService' })
  private reportsService: ReportsService;

  @Autowired({ typeName: 'TeamsService' })
  private teamsService: TeamsService;

  @Autowired({ typeName: 'UsersService' })
  private usersService: UsersService;

  constructor(private readonly inlineCommentsService: InlineCommentsService) {}

  @Get()
  @Public()
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
  @ApiResponse({
    status: 200,
    description: `Report inline comments`,
    content: {
      json: {
        examples: {
          inlineComments: {
            value: new NormalizedResponseDTO<InlineCommentDto[]>([InlineCommentDto.createEmpty()]),
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
            value: new ForbiddenException('You are not authorized to access this resource'),
          },
          forbiddenReport: {
            value: new ForbiddenException('You are not allowed to see comments of this report'),
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
          reportNotFound: {
            value: new NotFoundException('Report not found'),
          },
          teamNotFound: {
            value: new NotFoundException('Team not found'),
          },
        },
      },
    },
  })
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
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Search inline comments',
    description: 'Search inline comments',
  })
  @ApiResponse({
    status: 200,
    description: `Report inline comments`,
    content: {
      json: {
        examples: {
          inlineComments: {
            value: new NormalizedResponseDTO<InlineCommentDto[]>([InlineCommentDto.createEmpty()]),
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
  public async searchInlineComments(
    @CurrentToken() token: Token,
    @Query() searchInlineCommentsQuery: SearchInlineCommentsQuery,
  ): Promise<NormalizedResponseDTO<PaginatedResponseDto<InlineCommentDto>>> {
    let teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id);

    const noPersonFilters: boolean = !searchInlineCommentsQuery.report_author_id && !searchInlineCommentsQuery.inline_comment_author_id;

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

    // Get all reports in which I have visibility and I am the author
    const filterReports = {
      //team_id: { $in: teams.map((team: Team) => team.id) },
    };

    const filterReportsInWhichIAmAuthorOfATask = {
      $or: [],
    };

    let reportAuthorQuery = {};

    if (searchInlineCommentsQuery.report_author_id) {
      if (searchInlineCommentsQuery.report_author_id_operator === 'eq') {
        reportAuthorQuery = { $in: [searchInlineCommentsQuery.report_author_id] };
        filterReports['author_ids'] = reportAuthorQuery;
      } else {
        reportAuthorQuery = { $nin: [searchInlineCommentsQuery.report_author_id] };
        filterReports['author_ids'] = reportAuthorQuery;
      }
    } else {
      if (noPersonFilters) {
        reportAuthorQuery = { $in: [token.id] };
        filterReports['author_ids'] = reportAuthorQuery;
      }
    }

    const reports: Report[] = await this.reportsService.getReports({
      filter: filterReports,
    });

    const inlineCommentsQuery: any = {
      file_id: {
        $ne: null,
      },
      parent_comment_id: null,
      $or: [{ orphan: true }],
    };

    let taskAuthorQuery = {};
    if (searchInlineCommentsQuery.inline_comment_author_id) {
      if (searchInlineCommentsQuery.inline_comment_author_id_operator === 'eq') {
        // Get all reports in which I created a task
        taskAuthorQuery = { user_id: searchInlineCommentsQuery.inline_comment_author_id };

        const reportIdsInWhichIHaveTasks: string[] = await (
          await this.inlineCommentsService.getInlineComments({ filter: { user_id: searchInlineCommentsQuery.inline_comment_author_id } })
        ).map((x) => x.report_id);

        for (const reportId of reportIdsInWhichIHaveTasks) {
          filterReportsInWhichIAmAuthorOfATask.$or.push({ id: reportId });
        }
      } else {
        taskAuthorQuery = { user_id: { $ne: searchInlineCommentsQuery.inline_comment_author_id } };
        // Get all reports in which I created a task
        const reportIdsInWhichIHaveTasks: string[] = await (
          await this.inlineCommentsService.getInlineComments({ filter: { user_id: searchInlineCommentsQuery.inline_comment_author_id } })
        ).map((x) => x.report_id);

        for (const reportId of reportIdsInWhichIHaveTasks) {
          filterReportsInWhichIAmAuthorOfATask.$or.push({ id: { $ne: reportId } });
        }
      }
    } else {
      // If not set, by default look for inline comments in which the user is the author
      // Get all reports in which I created a task
      if (noPersonFilters) {
        taskAuthorQuery = { user_id: token.id };
        const reportIdsInWhichIHaveTasks: string[] = await (await this.inlineCommentsService.getInlineComments({ filter: { user_id: token.id } })).map((x) => x.report_id);
        for (const reportId of reportIdsInWhichIHaveTasks) {
          filterReportsInWhichIAmAuthorOfATask.$or.push({ id: reportId });
        }
      }
    }

    if (filterReportsInWhichIAmAuthorOfATask.$or.length > 0) {
      const reportsInWhichIHaveTasks: Report[] = await this.reportsService.getReports({
        filter: filterReportsInWhichIAmAuthorOfATask,
      });

      reports.push(...reportsInWhichIHaveTasks);
    }

    if (reports.length === 0) {
      const paginatedResponseDto: PaginatedResponseDto<InlineCommentDto> = new PaginatedResponseDto<InlineCommentDto>(1, 0, 0, [], 0, 0);
      return new NormalizedResponseDTO(paginatedResponseDto);
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
      inlineCommentsQuery.text = new RegExp(searchInlineCommentsQuery.text);

      // That searchs in all the fields, we only want to search in the field "text"
      // inlineCommentsQuery.$text = { $search: searchInlineCommentsQuery.text };
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

    const aggregation: any[] = [
      { $match: inlineCommentsQuery },
      { $lookup: { from: 'Report', localField: 'report_id', foreignField: 'id', as: 'report_data' } },
      { $unwind: { path: '$report_data', preserveNullAndEmptyArrays: false } },
      { $addFields: { date_created_at: { $toDate: '$created_at' } } },
      { $addFields: { date_updated_at: { $toDate: '$updated_at' } } },
      {
        $match: {
          $and: [
            {
              $or: [
                {
                  'report_data.author_ids': reportAuthorQuery,
                  // { $in: [searchInlineCommentsQuery.report_author_id ? searchInlineCommentsQuery.report_author_id : token.id] }
                },
                taskAuthorQuery,
                /*{
                  user_id: reportAuthorQuery,
                  // searchInlineCommentsQuery.report_author_id ? searchInlineCommentsQuery.report_author_id : token.id
                },*/
              ],
            },
            {
              'report_data.team_id': {
                $in: teams.map((x) => x.id),
              },
            },
          ],
        },
      },
      {
        $sort: { ['date_' + searchInlineCommentsQuery.order_by]: searchInlineCommentsQuery.order_direction === 'asc' ? 1 : -1 },
      },
    ];

    const inlineComments: InlineComment[] = await db
      .collection('InlineComment')
      .aggregate(aggregation)
      // .find(inlineCommentsQuery)
      .skip((searchInlineCommentsQuery.page - 1) * searchInlineCommentsQuery.limit)
      .limit(searchInlineCommentsQuery.limit)
      .sort({
        ['date_' + searchInlineCommentsQuery.order_by]: searchInlineCommentsQuery.order_direction === 'asc' ? 1 : -1,
      })
      .toArray();

    const aggregateCount: any = await db
      .collection('InlineComment')
      .aggregate([
        {
          $facet: {
            results: [
              { $match: inlineCommentsQuery },
              { $lookup: { from: 'Report', localField: 'report_id', foreignField: 'id', as: 'report_data' } },
              { $unwind: { path: '$report_data', preserveNullAndEmptyArrays: false } },
              {
                $match: {
                  $and: [
                    {
                      $or: [
                        {
                          'report_data.author_ids': reportAuthorQuery,
                          // { $in: [searchInlineCommentsQuery.report_author_id ? searchInlineCommentsQuery.report_author_id : token.id] }
                        },
                        taskAuthorQuery,
                        /*{
                          user_id: reportAuthorQuery,
                          // searchInlineCommentsQuery.report_author_id ? searchInlineCommentsQuery.report_author_id : token.id
                        },*/
                      ],
                    },
                    {
                      'report_data.team_id': {
                        $in: teams.map((x) => x.id),
                      },
                    },
                  ],
                },
              },
              {
                $group: {
                  _id: null,
                  Total: { $sum: 1 },
                },
              },
            ],
            count: [
              {
                $group: {
                  _id: null,
                  Total: { $sum: 1 },
                },
              },
            ],
          },
        },
      ])
      .limit(searchInlineCommentsQuery.limit)
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

    let totalItems = 0;

    try {
      totalItems = aggregateCount[0].results[0].Total;
    } catch (ex) {
      // silent
    }
    // const totalItems: number = await this.inlineCommentsService.countInlineComments({ filter: inlineCommentsQuery });
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
  @ApiBearerAuth()
  @ApiOperation({
    summary: `Count opened inline comments`,
    description: `Count opened inline comments`,
  })
  @ApiResponse({
    status: 200,
    description: `Opened inline comments`,
    content: {
      json: {
        examples: {
          inlineComments: {
            value: new NormalizedResponseDTO<number>(10),
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
  public async countOpenedInlineComments(@CurrentToken() token: Token): Promise<NormalizedResponseDTO<number>> {
    const query = {
      limit: 1,
      order_by: 'created_at',
      order_direction: 'desc',
      page: 1,
      status: [InlineCommentStatusEnum.DOING, InlineCommentStatusEnum.OPEN, InlineCommentStatusEnum.TO_DO],
      status_operator: 'in',
    };
    const result: NormalizedResponseDTO<PaginatedResponseDto<InlineCommentDto>> = await this.searchInlineComments(token, query as SearchInlineCommentsQuery);
    return new NormalizedResponseDTO(result.data.totalItems);
  }

  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Get inline comment',
    description: 'Get inline comment',
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Id of the inline comment',
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: `Report inline comments`,
    content: {
      json: {
        examples: {
          inlineComment: {
            value: new NormalizedResponseDTO<InlineCommentDto>(InlineCommentDto.createEmpty()),
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
          invalidId: {
            value: new BadRequestException('Invalid id'),
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
            value: new ForbiddenException('You are not allowed to get this inline comment'),
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
          inlineCommentNotFound: {
            value: new NotFoundException('Inline comment not found'),
          },
          reportNotFound: {
            value: new NotFoundException('Report not found'),
          },
          teamNotFound: {
            value: new NotFoundException('Team not found'),
          },
        },
      },
    },
  })
  async getInlineComment(@CurrentToken() token: Token, @Param('id') id: string): Promise<NormalizedResponseDTO<InlineCommentDto>> {
    if (!Validators.isValidObjectId(id)) {
      throw new BadRequestException('Invalid id');
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
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: 'Create a new inline comment',
    description: 'Create a new inline comment',
  })
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
  @ApiBody({
    description: 'New inline comment',
    required: true,
    examples: {
      inlineComment: {
        value: new CreateInlineCommentDto('647f368421b67cfee313159f', '64899abab17518e0e421dc1c', 'f5231f', 'Check the definition of the function', [], null),
      },
      replyInlineComment: {
        value: new CreateInlineCommentDto('647f368421b67cfee313159f', '64899abab17518e0e421dc1c', 'f5231f', 'Fixing...', [], '647f368121b67cfee3131535'),
      },
      inlineCommentWithMentions: {
        value: new CreateInlineCommentDto(
          '647f368421b67cfee313159f',
          '64899abab17518e0e421dc1c',
          'f5231f',
          'Check the definition of the function',
          ['647f368121b67cfee3131527', '647f368221b67cfee3131543'],
          null,
        ),
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Inline comment created',
    content: {
      json: {
        examples: {
          inlineComments: {
            value: new NormalizedResponseDTO<InlineCommentDto>(InlineCommentDto.createEmpty()),
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
          reportNotFound: {
            value: new NotFoundException('Report not found'),
          },
          teamNotFound: {
            value: new NotFoundException('Team not found'),
          },
          organizationNotFound: {
            value: new NotFoundException('Organization not found'),
          },
        },
      },
    },
  })
  @Permission([InlineCommentPermissionsEnum.CREATE])
  async createInlineComment(@CurrentToken() token: Token, @Body() createInlineCommentDto: CreateInlineCommentDto): Promise<NormalizedResponseDTO<InlineCommentDto>> {
    const inlineComment: InlineComment = await this.inlineCommentsService.createInlineComment(token.id, createInlineCommentDto);
    const relations: Relations = await this.relationsService.getRelations(inlineComment, 'InlineComment', { mentions: 'User' });
    const inlineCommentDto: InlineCommentDto = await this.inlineCommentsService.inlineCommentModelToInlineCommentDto(inlineComment);
    return new NormalizedResponseDTO(inlineCommentDto, relations);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: 'Update an inline comment',
    description: 'Update an inline comment',
  })
  @ApiBody({
    description: 'Update inline comment',
    required: true,
    examples: {
      json: {
        value: new UpdateInlineCommentDto('647f368421b67cfee313159f', 'Check the type of the variable you defined', [], InlineCommentStatusEnum.CLOSED),
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Inline comment updated',
    content: {
      json: {
        examples: {
          inlineComments: {
            value: new NormalizedResponseDTO<InlineCommentDto>(InlineCommentDto.createEmpty()),
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
          notFound: {
            value: new NotFoundException('Inline comment not found'),
          },
          reportNotFound: {
            value: new NotFoundException('Report not found'),
          },
          teamNotFound: {
            value: new NotFoundException('Team not found'),
          },
          organizationNotFound: {
            value: new NotFoundException('Organization not found'),
          },
          userNotFound: {
            value: new NotFoundException('User not found'),
          },
        },
      },
    },
  })
  async updateInlineComment(@CurrentToken() token: Token, @Param('id') id: string, @Body() updateInlineCommentDto: UpdateInlineCommentDto): Promise<NormalizedResponseDTO<InlineCommentDto>> {
    const inlineComment: InlineComment = await this.inlineCommentsService.updateInlineComment(token, id, updateInlineCommentDto);
    const relations: Relations = await this.relationsService.getRelations(inlineComment, 'InlineComment', { mentions: 'User' });
    const inlineCommentDto: InlineCommentDto = await this.inlineCommentsService.inlineCommentModelToInlineCommentDto(inlineComment);
    return new NormalizedResponseDTO(inlineCommentDto, relations);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Delete an inline comment`,
    description: `Allows deleting an inline comment.`,
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Id of the inline comment to delete',
    schema: { type: 'string' },
  })
  @ApiResponse({
    status: 200,
    description: 'Inline comment deleted',
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
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException('You are not allowed to delete this inline comment'),
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
          notFound: {
            value: new NotFoundException('Inline comment not found'),
          },
          reportNotFound: {
            value: new NotFoundException('Report not found'),
          },
          teamNotFound: {
            value: new NotFoundException('Team not found'),
          },
          organizationNotFound: {
            value: new NotFoundException('Organization not found'),
          },
          userNotFound: {
            value: new NotFoundException('User not found'),
          },
        },
      },
    },
  })
  async delete(@CurrentToken() token: Token, @Param('id') id: string): Promise<NormalizedResponseDTO<boolean>> {
    const deleted: boolean = await this.inlineCommentsService.deleteInlineComment(token, id);
    return new NormalizedResponseDTO(deleted);
  }
}
