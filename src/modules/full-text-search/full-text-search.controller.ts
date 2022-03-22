import { NormalizedResponseDTO, Tag, FullTextSearchDTO, FullTextSearchResult, Token, Team, TeamVisibilityEnum } from '@kyso-io/kyso-model'
import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Autowired } from '../../decorators/autowired'
import { AuthService } from '../auth/auth.service'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { PlatformRoleService } from '../auth/platform-role.service'
import { UserRoleService } from '../auth/user-role.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { TeamsService } from '../teams/teams.service'
import { UsersService } from '../users/users.service'
import { FullTextSearchService } from './full-text-search.service'

@ApiTags('search')
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('search')
export class FullTextSearchController {
    @Autowired({ typeName: 'FullTextSearchService' })
    private searchService: FullTextSearchService

    @Autowired({ typeName: 'AuthService' })
    private authService: AuthService

    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    @Autowired({ typeName: 'TeamsService' })
    private teamsService: TeamsService

    @Autowired({ typeName: 'OrganizationsService' })
    private organizationsService: OrganizationsService

    @Autowired({ typeName: 'PlatformRoleService' })
    private platformRoleService: PlatformRoleService

    @Autowired({ typeName: 'UserRoleService' })
    private userRoleService: UserRoleService

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
        @Headers('authorization') authHeader: string
    ): Promise<NormalizedResponseDTO<FullTextSearchDTO>> {
        if(!perPage) {
            perPage = 20
        }

        const searchResults: FullTextSearchDTO =  await this.searchService.search(searchTerms, type, page, perPage, filterOrgs, filterTeams, filterTags, filterPeople);

        // Filter the results to remove all the reports that are private or protected and belongs to an organization or team which the current user
        // does not belongs

        // Retrieve the current user
        const token : Token = this.authService.evaluateAndDecodeTokenFromHeader(authHeader)
        
        // Retrieve the organizations and teams the current user belongs to
        token.permissions = await AuthService.buildFinalPermissionsForUser(
            token.username,
            this.usersService,
            this.teamsService,
            this.organizationsService,
            this.platformRoleService,
            this.userRoleService,
        )

        // Put all the teams in an array
        const allUserTeams: string[] = token.permissions.teams.map(x => x.name)
        // const allUserOrganizations: string[] = token.permissions.organizations.map(x => x.name)
        
        // Retrieve all the teams involved in the results of this page
        const resultsTeamsNames: string[] = searchResults.reports.results.map((x: FullTextSearchResult) => {
            return x.team
        })

        const bannedTeams: string[] = []

        // Remove duplicates 
        const uniqueResultsTeamNames = new Set(resultsTeamsNames)

        // Retrieve team information to know if the team is public, private or protected
        for(const aux of uniqueResultsTeamNames) {
            const t_aux: Team = await this.teamsService.getTeam({ filter: {sluglified_name: aux} })
            
            if(t_aux) {
                if(t_aux.visibility !== TeamVisibilityEnum.PUBLIC) {
                    if(!allUserTeams.includes(t_aux.sluglified_name)) {
                        bannedTeams.push(t_aux.sluglified_name)
                    }
                }
            }
        }

        // Remove all the bannedTeams from the results
        const censoredResults = searchResults.reports.results.filter((x: FullTextSearchResult) => {
            return !bannedTeams.includes(x.team)
        })
        
        return new NormalizedResponseDTO(censoredResults, null);
    }
}
