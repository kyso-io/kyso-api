import { NormalizedResponseDTO, Tag, FullTextSearchDTO } from '@kyso-io/kyso-model'
import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Autowired } from '../../decorators/autowired'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { FullTextSearchService } from './full-text-search.service'

@ApiTags('search')
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('search')
export class FullTextSearchController {
    @Autowired({ typeName: 'FullTextSearchService' })
    private searchService: FullTextSearchService

    constructor() {}

    @Get()
    @ApiOperation({
        summary: `Search`,
        description: `Search`,
    })
    @ApiQuery({ name: 'terms', required: true, description: 'Search tearms to perform the search' })
    @ApiQuery({ name: 'page', required: true, description: "Result's page to be retrieved" })
    @ApiQuery({ name: 'type', required: true, description: 'Type of object to search for', example: 'report, discussion, comment, member' })
    @ApiQuery({ name: 'perPage', required: false, description: 'Number of results per page. 20 if not set' })
    @ApiQuery({ name: 'filter.tags', required: false, description: 'List of tags to filter', example: 'tag1,tag2,tag3' })
    @ApiQuery({ name: 'filter.orgs', required: false, description: 'List or organizations to filter', example: 'lightside,darkside' })
    @ApiQuery({ name: 'filter.teams', required: false, description: 'List or teams to filter', example: 'protected-team,private-team,public-team' })
    @ApiQuery({ name: 'filter.people', required: false, description: 'List or persons to filter', example: 'palpatine@kyso.io,rey@kyso.io' })
    @ApiNormalizedResponse({ status: 200, description: `Search results`, type: Tag, isArray: true })
    public async search(
        @Query('terms') searchTerms: string,
        @Query('page') page: number,
        @Query('perPage') perPage: number,
        @Query('type') type: string,
        @Query('filter.tags') filterTags: string,
        @Query('filter.orgs') filterOrgs: string,
        @Query('filter.teams') filterTeams: string,
        @Query('filter.people') filterPeople: string,
    ): Promise<NormalizedResponseDTO<FullTextSearchDTO>> {
        if(!perPage) {
            perPage = 20
        }

        const searchResults =  await this.searchService.search(searchTerms, type, page, perPage, filterOrgs, filterTeams, filterTags, filterPeople);
        return new NormalizedResponseDTO(searchResults, null);
    }
}
