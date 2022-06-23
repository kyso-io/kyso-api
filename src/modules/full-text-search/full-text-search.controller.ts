import {
    FullTextSearchDTO,
    FullTextSearchResult,
    GlobalPermissionsEnum,
    KysoSettingsEnum,
    NormalizedResponseDTO,
    Tag,
    Team,
    TeamVisibilityEnum,
    Token,
} from '@kyso-io/kyso-model'
import { Controller, Get, Headers, Logger, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import axios from 'axios'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Autowired } from '../../decorators/autowired'
import { Permission } from '../auth/annotations/permission.decorator'
import { AuthService } from '../auth/auth.service'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { PlatformRoleService } from '../auth/platform-role.service'
import { UserRoleService } from '../auth/user-role.service'
import { DiscussionsService } from '../discussions/discussions.service'
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service'
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
    private fullTextSearchService: FullTextSearchService

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

    @Autowired({ typeName: 'KysoSettingsService' })
    private kysoSettingsService: KysoSettingsService

    @Autowired({ typeName: 'DiscussionsService' })
    private discussionsService: DiscussionsService

    constructor() {}

    @Get()
    @ApiOperation({
        summary: `Search`,
        description: `Search`,
    })
    @ApiQuery({ name: 'terms', required: true, description: 'Search tearms to perform the search' })
    @ApiQuery({ name: 'page', required: true, description: "Result's page to be retrieved" })
    @ApiQuery({ name: 'type', required: true, description: 'Type of object to search for', example: 'report, discussion, comment, member' })
    @ApiQuery({ name: 'perPage', required: false, description: 'Number of results per page. 100 if not set' })
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
        @Headers('authorization') authHeader: string,
    ): Promise<NormalizedResponseDTO<FullTextSearchDTO>> {
        if (!perPage) {
            perPage = 100
        }

        const searchResults: FullTextSearchDTO = await this.fullTextSearchService.search(
            searchTerms,
            type,
            page,
            perPage,
            filterOrgs,
            filterTeams,
            filterTags,
            filterPeople,
        )

        // Filter the results to remove all the reports that are private or protected and belongs to an organization or team which the current user
        // does not belongs

        // Retrieve the current user
        const token: Token = this.authService.evaluateAndDecodeTokenFromHeader(authHeader)

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
        const allUserTeams: string[] = token.permissions.teams.map((x) => x.name)
        // const allUserOrganizations: string[] = token.permissions.organizations.map(x => x.name)

        // Retrieve all the teams involved in the results of this page
        const resultsTeamsNames: string[] = searchResults.reports.results.map((x: FullTextSearchResult) => {
            return x.team
        })

        const bannedTeams: string[] = []

        // Remove duplicates
        const uniqueResultsTeamNames = new Set(resultsTeamsNames)

        // Retrieve team information to know if the team is public, private or protected
        for (const aux of uniqueResultsTeamNames) {
            const t_aux: Team = await this.teamsService.getTeam({ filter: { sluglified_name: aux } })

            if (t_aux) {
                if (t_aux.visibility !== TeamVisibilityEnum.PUBLIC) {
                    if (!allUserTeams.includes(t_aux.sluglified_name)) {
                        bannedTeams.push(t_aux.sluglified_name)
                    }
                }
            }
        }

        // Remove all the bannedTeams from the results
        const censoredResults = searchResults.reports.results.filter((x: FullTextSearchResult) => {
            return !bannedTeams.includes(x.team)
        })

        // Remove duplicated tags, teams and organizations and process tags
        const finalTagsSet = new Set<string>()
        const finalOrganizationsSet = new Set<string>()
        const finalTeamsSet = new Set<string>()

        for (let orgItem of searchResults.reports.organizations) {
            try {
                finalOrganizationsSet.add(orgItem)
            } catch (ex) {
                // silent it
            }
        }

        for (let teamItem of searchResults.reports.teams) {
            try {
                finalTeamsSet.add(teamItem)
            } catch (ex) {
                // silent it
            }
        }

        for (let tagArray of searchResults.reports.tags) {
            try {
                const tags = tagArray.replace('[', '').replace(']', '').split(',')
                for (let tag of tags) {
                    finalTagsSet.add(tag)
                }
            } catch (ex) {
                // silent it
            }
        }

        // start Hack requested by @kyle for a demo ;P
        /*finalTagsSet.add("churn")
        finalTagsSet.add("engagement")
        finalTagsSet.add("b2b-chorts")

        const fakeData: FullTextSearchResult[] = [];
        
        fakeData.push(
            new FullTextSearchResult(
                "What is driving the purchase behaviour of Acme's customers?",
                "This notebook contains an analysis on some marketing data. The goal for this project was to do the following: 1. Get acquainted with the data, 2. Clean the data so it is ready for analysis, 3. Develop some questions for analysis, and 4. Analyse variables within the data to gain patterns and insights. It has been shown income has the strongest relationship with purchase behavior of customers. However, interesting insights about education and age along with age_group have still been noted. These insights would be very helpful to how this store markets deals to their customers and prices items, such as wine since higher income groups tend to dominate alcohol sales. There is also opportunity to increase market to the 18 to 35 and 71 and Older age groups to drive products sales.",
                "acme/marketing/what-is-driving-the-purchase-behaviour-of-acmes-customers",
                "report",
                [],
                "marketing", "acme", ["customer-patterns", "buyer-behaviour", "product-usage"],
                "what-is-driving-the-purchase-behaviour-of-acmes-customers", 1, "", 91.312
            )
        )

        fakeData.push(
            new FullTextSearchResult(
                "Plotting Account Activity Levels",
                "Measuring the relationship between team size and various engagement metrics like viewspostsand other actions. Should we be focusing more time on smaller accounts or only on the big fish?. Given that we're a SaaS company that charges per seat for team subscriptions, user engagement is super important for maintaining our high retention levels. Also, because we do charge per seat, by measuring the relationship between team size and various engagement metrics like views, posts, and other actions. Should we be focusing more time on smaller accounts or only on the big fish?",
                "acme/product/plotting-account-activity-levels",
                "report",
                [],
                "product", "acme", ["churn", "engagement", "b2b-chorts"],
                "plotting-account-activity-levels", 1, "", 91.312
            )
        )

        fakeData.push(
            new FullTextSearchResult(
                "Customer Survival Analysis 2021",
                "Customer attrition, also known as customer churn, customer turnover, or customer defection, is the loss of clients or customers. Predictive analytics use churn prediction models that predict customer churn by assessing their propensity of risk to churn. Predictive analytics use churn prediction models that predict customer churn by assessing their propensity of risk to churn. Since these models generate a small prioritized list of potential defectors, they are effective at focusing customer retention marketing programs on the subset of the customer base who are most vulnerable to churn. In this project we aim to perform customer survival analysis and build a model which can predict customer churn. We also aim to build an app which can be used to understand why a specific customer would stop the service and to know his/her expected lifetime value.",
                "acme/product/customer-survival-analysis-2021",
                "report",
                [],
                "product", "acme", ["churn", "b2b", "survival-analysis"],
                "customer-survival-analysis-2021", 3, "", 91.312
            )
        )

        fakeData.push(
            new FullTextSearchResult(
                "B2B App Cohort Analysis",
                "Some interesting visualizations and conclusions from our latest cohort analyses... It appears that the May 2016 cohort has decreased in revenue while the others may have had expansion offsetting churned revenue. The revenue retention visualization really provides more information about the 2016 customer cohort. All 12 months of cohort groups have had some churn or expansion. We would want to follow-up and figure out how customer success or onboarding (or account management) contributed to the April, June, August, September and November cohort expansion and bring those best practices to the rest of the customer base. Conversely, are there any lessons learned from the May cohort and can we turn these customers' usage around.",
                "acme/product/b2b-app-cohort-analysis",
                "report",
                [],
                "product", "acme", [],
                "b2b-app-cohort-analysis", 1, "", 91.312
            )
        )

        fakeData.push(
            new FullTextSearchResult(
                "How good is Acme at activating its customers and retaining high usage throughout the first 3 months after signup?",
                "How good is Acme at activating its customers and retaining high usage throughout the first 3 months after signup?. We are tasked to Perform Cohort and Recency Frequency and Monetary Value Analysis to understand the value derived from different customer segments. Further, we will divide customers in different cluster traits based on the analysis by using Unsupervised Learning Techniques.",
                "acme/product/how-good-is-acme-at-activating-its-customers-and-retaining-high-usage-throughout-the-first-3-months-after-signup",
                "report",
                [],
                "product", "acme", [],
                "how-good-is-acme-at-activating-its-customers-and-retaining-high-usage-throughout-the-first-3-months-after-signup", 2, "", 91.312
            )
        )

        
        searchResults.reports.teams.push("product")
        searchResults.reports.teams.push("marketing")
        searchResults.reports.organizations.push("acme")

                
        searchResults.reports.results = [...fakeData, ...censoredResults]*/

        searchResults.reports.results = [...censoredResults]
        searchResults.reports.tags = Array.from(finalTagsSet)
        searchResults.reports.organizations = Array.from(finalOrganizationsSet)
        searchResults.reports.teams = Array.from(finalTeamsSet)

        return new NormalizedResponseDTO(searchResults, null)
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
        const kysoIndexerApi: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.KYSO_INDEXER_API_BASE_URL)
        axios.get(`${kysoIndexerApi}/api/reindex?pathToIndex=${pathToIndex}`).then(
            () => {},
            (err) => {
                Logger.warn(`${pathToIndex} was not indexed properly`, err)
            },
        )
        return { status: 'queued' }
    }

    @Get('/reindex-users')
    @ApiOperation({
        summary: `Reindex users`,
        description: `Reindex users`,
    })
    @ApiNormalizedResponse({ status: 200, description: `Indexing users`, type: Tag, isArray: true })
    @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
    public async reindexUsers() {
        this.usersService.reindexUsers()
        return { status: 'indexing' }
    }

    @Get('/reindex-discussions')
    @ApiOperation({
        summary: `Reindex discussions`,
        description: `Reindex discussions`,
    })
    @ApiNormalizedResponse({ status: 200, description: `Indexing discussions`, type: Tag, isArray: true })
    @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
    public async reindexDiscussions() {
        this.discussionsService.reindexDiscussions()
        return { status: 'indexing' }
    }
}
