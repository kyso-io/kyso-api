import {
  ElasticSearchIndex,
  FullTextSearchAggregators,
  FullTextSearchDTO,
  FullTextSearchMetadata,
  FullTextSearchResultType,
  GlobalPermissionsEnum,
  NormalizedResponseDTO,
  Token,
} from '@kyso-io/kyso-model';
import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Autowired } from '../../decorators/autowired';
import { Public } from '../../decorators/is-public';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { Permission } from '../auth/annotations/permission.decorator';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { CommentsService } from '../comments/comments.service';
import { DiscussionsService } from '../discussions/discussions.service';
import { InlineCommentsService } from '../inline-comments/inline-comments.service';
import { ReportsService } from '../reports/reports.service';
import { UsersService } from '../users/users.service';
import { FullTextSearchService } from './full-text-search.service';

@ApiTags('search')
@UseGuards(PermissionsGuard)
@Controller('search')
export class FullTextSearchController {
  @Autowired({ typeName: 'FullTextSearchService' })
  private fullTextSearchService: FullTextSearchService;

  @Autowired({ typeName: 'UsersService' })
  private usersService: UsersService;

  @Autowired({ typeName: 'DiscussionsService' })
  private discussionsService: DiscussionsService;

  @Autowired({ typeName: 'CommentsService' })
  private commentsService: CommentsService;

  @Autowired({ typeName: 'ReportsService' })
  private reportsService: ReportsService;

  @Autowired({ typeName: 'InlineCommentsService' })
  private inlineCommentsService: InlineCommentsService;

  @Get()
  @Public()
  @ApiOperation({
    summary: `Search`,
    description: `Search`,
  })
  @ApiQuery({ name: 'terms', required: true, description: 'Search tearms to perform the search' })
  @ApiQuery({ name: 'page', required: true, description: "Result's page to be retrieved" })
  @ApiQuery({ name: 'type', required: true, description: 'Type of object to search for', example: 'report, discussion, comment, member' })
  @ApiQuery({ name: 'perPage', required: false, description: 'Number of results per page. 100 if not set' })
  @ApiQuery({ name: 'filter.orgs', required: false, description: 'List or organizations to filter', example: 'lightside,darkside' })
  @ApiQuery({ name: 'filter.teams', required: false, description: 'List or teams to filter', example: 'protected-team,private-team,public-team' })
  @ApiQuery({ name: 'filter.people', required: false, description: 'List or persons to filter', example: 'palpatine@kyso.io,rey@kyso.io' })
  @ApiQuery({ name: 'filter.tags', required: false, description: 'List of tags to filter', example: 'tag1,tag2,tag3' })
  @ApiQuery({ name: 'filter.files', required: false, description: 'List of file extensions', example: 'csv,tsv,md' })
  @ApiQuery({ name: 'orderBy', required: false, description: 'Field to order by', example: 'name,createdAt,updatedAt' })
  @ApiQuery({ name: 'order', required: false, description: 'Order', example: 'asc,desc' })
  @ApiResponse({
    status: 200,
    description: 'Elasticsearch result given query params',
    content: {
      json: {
        examples: {
          fullTextSearchResult: {
            value: new NormalizedResponseDTO<boolean>(FullTextSearchDTO.createEmpty()),
          },
        },
      },
    },
  })
  public async fullTextSearch(
    @CurrentToken() token: Token,
    @Query('terms') searchTerms: string,
    @Query('page') page: number,
    @Query('type') type: string,
    @Query('perPage') perPage: number,
    @Query('filter.orgs') filterOrgs: string,
    @Query('filter.teams') filterTeams: string,
    @Query('filter.people') filterPeople: string,
    @Query('filter.tags') filterTags: string,
    @Query('filter.fileTypes') filterFileTypes: string,
    @Query('orderBy') orderBy: string,
    @Query('order') order: string,
  ): Promise<NormalizedResponseDTO<FullTextSearchDTO>> {
    if (searchTerms) {
      const fullTextSearchDTO: FullTextSearchDTO = await this.fullTextSearchService.fullTextSearch(
        token,
        searchTerms,
        page,
        perPage,
        type as ElasticSearchIndex,
        filterOrgs ? filterOrgs.split(',') : [],
        filterTeams ? filterTeams.split(',') : [],
        filterPeople ? filterPeople.split(',') : [],
        filterTags ? filterTags.split(',') : [],
        filterFileTypes ? filterFileTypes.split(',') : [],
        orderBy,
        order,
      );
      return new NormalizedResponseDTO(fullTextSearchDTO, null);
    } else {
      const fullTextSearchAggregators: FullTextSearchAggregators = new FullTextSearchAggregators([], [], [], [], []);
      const emptyMeta: FullTextSearchMetadata = new FullTextSearchMetadata(page, 0, perPage, 0, fullTextSearchAggregators);
      const emptyResult: FullTextSearchResultType = new FullTextSearchResultType([], emptyMeta);
      const fullTextSearchDTO: FullTextSearchDTO = new FullTextSearchDTO(emptyResult, emptyResult, emptyResult, emptyResult, emptyResult);
      return new NormalizedResponseDTO(fullTextSearchDTO, null);
    }
  }

  @Get('/reindex')
  @ApiBearerAuth()
  @ApiOperation({
    summary: `Reindex`,
    description: `Reindex`,
  })
  @ApiQuery({ name: 'pathToIndex', required: true, description: '/sftp/data/scs' })
  @ApiResponse({
    status: 200,
    description: 'Indexing data',
    content: {
      json: {
        examples: {
          result: {
            value: {
              status: 'indexing',
            },
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
  @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
  public async reindex(@Query('pathToIndex') pathToIndex: string): Promise<{ status: 'indexing' }> {
    await this.reportsService.reindexReports(pathToIndex);
    this.usersService.reindexUsers();
    this.discussionsService.reindexDiscussions();
    this.commentsService.reindexComments();
    this.inlineCommentsService.reindexInlineComments();
    return { status: 'indexing' };
  }

  @Get('/reindex-reports')
  @ApiBearerAuth()
  @ApiOperation({
    summary: `Reindex reports`,
    description: `Reindex reports`,
  })
  @ApiQuery({ name: 'pathToIndex', required: true, description: '/sftp/data/scs' })
  @ApiResponse({
    status: 200,
    description: 'Indexing reports',
    content: {
      json: {
        examples: {
          result: {
            value: {
              status: 'indexing',
            },
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
  @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
  public async reindexReports(@Query('pathToIndex') pathToIndex: string): Promise<{ status: 'indexing' }> {
    return this.reportsService.reindexReports(pathToIndex);
  }

  @Get('/reindex-users')
  @ApiBearerAuth()
  @ApiOperation({
    summary: `Reindex users`,
    description: `Reindex users`,
  })
  @ApiResponse({
    status: 200,
    description: 'Indexing users',
    content: {
      json: {
        examples: {
          result: {
            value: {
              status: 'indexing',
            },
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
  @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
  public async reindexUsers(): Promise<{ status: 'indexing' }> {
    this.usersService.reindexUsers();
    return { status: 'indexing' };
  }

  @Get('/reindex-discussions')
  @ApiBearerAuth()
  @ApiOperation({
    summary: `Reindex discussions`,
    description: `Reindex discussions`,
  })
  @ApiResponse({
    status: 200,
    description: 'Indexing discussions',
    content: {
      json: {
        examples: {
          result: {
            value: {
              status: 'indexing',
            },
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
  @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
  public async reindexDiscussions(): Promise<{ status: 'indexing' }> {
    this.discussionsService.reindexDiscussions();
    return { status: 'indexing' };
  }

  @Get('/reindex-comments')
  @ApiBearerAuth()
  @ApiOperation({
    summary: `Reindex comments`,
    description: `Reindex comments`,
  })
  @ApiResponse({
    status: 200,
    description: 'Indexing comments',
    content: {
      json: {
        examples: {
          result: {
            value: {
              status: 'indexing',
            },
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
  @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
  public async reindexComments(): Promise<{ status: 'indexing' }> {
    this.commentsService.reindexComments();
    return { status: 'indexing' };
  }

  @Get('/reindex-inline-comments')
  @ApiBearerAuth()
  @ApiOperation({
    summary: `Reindex inline comments`,
    description: `Reindex inline comments`,
  })
  @ApiResponse({
    status: 200,
    description: 'Indexing inline comments',
    content: {
      json: {
        examples: {
          result: {
            value: {
              status: 'indexing',
            },
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
  @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
  public async reindexInlineComments(): Promise<{ status: 'indexing' }> {
    this.inlineCommentsService.reindexInlineComments();
    return { status: 'indexing' };
  }
}
