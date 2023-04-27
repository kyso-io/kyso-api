import {
  ElasticSearchIndex,
  FullTextSearchAggregators,
  FullTextSearchDTO,
  FullTextSearchMetadata,
  FullTextSearchResultType,
  GlobalPermissionsEnum,
  NormalizedResponseDTO,
  Tag,
  Token,
} from '@kyso-io/kyso-model';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
import { Autowired } from '../../decorators/autowired';
import { Public } from '../../decorators/is-public';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { Permission } from '../auth/annotations/permission.decorator';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { CommentsService } from '../comments/comments.service';
import { DiscussionsService } from '../discussions/discussions.service';
import { ReportsService } from '../reports/reports.service';
import { UsersService } from '../users/users.service';
import { FullTextSearchService } from './full-text-search.service';
import { InlineCommentsService } from '../inline-comments/inline-comments.service';

@ApiTags('search')
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
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
  @ApiNormalizedResponse({ status: 200, description: `Search results`, type: Tag, isArray: true })
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
  @ApiOperation({
    summary: `Reindex`,
    description: `Reindex`,
  })
  @ApiQuery({ name: 'pathToIndex', required: true, description: '/sftp/data/scs' })
  @ApiNormalizedResponse({ status: 200, description: `Search results`, type: Tag, isArray: true })
  @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
  public async reindex(@Query('pathToIndex') pathToIndex: string) {
    await this.reportsService.reindexReports(pathToIndex);
    this.usersService.reindexUsers();
    this.discussionsService.reindexDiscussions();
    this.commentsService.reindexComments();
    this.inlineCommentsService.reindexInlineComments();
    return { status: 'indexing' };
  }

  @Get('/reindex-reports')
  @ApiOperation({
    summary: `Reindex reports`,
    description: `Reindex reports`,
  })
  @ApiQuery({ name: 'pathToIndex', required: true, description: '/sftp/data/scs' })
  @ApiNormalizedResponse({ status: 200, description: `Search results`, type: Tag, isArray: true })
  @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
  public async reindexReports(@Query('pathToIndex') pathToIndex: string) {
    return this.reportsService.reindexReports(pathToIndex);
  }

  @Get('/reindex-users')
  @ApiOperation({
    summary: `Reindex users`,
    description: `Reindex users`,
  })
  @ApiNormalizedResponse({ status: 200, description: `Indexing users`, type: Tag, isArray: true })
  @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
  public async reindexUsers() {
    this.usersService.reindexUsers();
    return { status: 'indexing' };
  }

  @Get('/reindex-discussions')
  @ApiOperation({
    summary: `Reindex discussions`,
    description: `Reindex discussions`,
  })
  @ApiNormalizedResponse({ status: 200, description: `Indexing discussions`, type: Tag, isArray: true })
  @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
  public async reindexDiscussions() {
    this.discussionsService.reindexDiscussions();
    return { status: 'indexing' };
  }

  @Get('/reindex-comments')
  @ApiOperation({
    summary: `Reindex comments`,
    description: `Reindex comments`,
  })
  @ApiNormalizedResponse({ status: 200, description: `Indexing comments`, type: Tag, isArray: true })
  @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
  public async reindexComments() {
    this.commentsService.reindexComments();
    return { status: 'indexing' };
  }

  @Get('/reindex-inline-comments')
  @ApiOperation({
    summary: `Reindex inline comments`,
    description: `Reindex inline comments`,
  })
  @ApiNormalizedResponse({ status: 200, description: `Indexing inline comments`, type: Tag, isArray: true })
  @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
  public async reindexInlineComments() {
    this.inlineCommentsService.reindexInlineComments();
    return { status: 'indexing' };
  }
}
