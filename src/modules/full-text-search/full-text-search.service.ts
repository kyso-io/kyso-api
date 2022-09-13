import {
    ElasticSearchIndex,
    FullTextSearchDTO,
    FullTextSearchMetadata,
    FullTextSearchResultType,
    KysoIndex,
    KysoSettingsEnum,
    Organization,
    ResourcePermissions,
    Team,
    TeamVisibilityEnum,
    Token,
} from '@kyso-io/kyso-model'
import { Injectable, Logger, Provider } from '@nestjs/common'
import axios, { AxiosResponse } from 'axios'
import { unique } from 'typedoc/dist/lib/utils'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { TeamsService } from '../teams/teams.service'
import { AggregateData, AggregationBucket, Aggregations, TypeBucket } from './aggregate-data'
import { Hit, SearchData } from './search-data'

function factory(service: FullTextSearchService) {
    return service
}

export function createProvider(): Provider<FullTextSearchService> {
    return {
        provide: `${FullTextSearchService.name}`,
        useFactory: (service) => factory(service),
        inject: [FullTextSearchService],
    }
}

@Injectable()
export class FullTextSearchService extends AutowiredService {
    private readonly KYSO_INDEX = 'kyso-index'

    @Autowired({ typeName: 'KysoSettingsService' })
    private kysoSettingsService: KysoSettingsService

    @Autowired({ typeName: 'OrganizationsService' })
    private organizationsService: OrganizationsService

    @Autowired({ typeName: 'TeamsService' })
    private teamsService: TeamsService

    constructor() {
        super()
    }

    public async deleteIndexedResults(organizationSlug: string, teamSlug: string, entityId: string, type: ElasticSearchIndex): Promise<any> {
        Logger.log(`Deleting indexed data for ${organizationSlug} and ${teamSlug} and ${entityId} for ${type}`)
        const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL)
        let query = {
            query: {
                bool: {
                    must: [
                        {
                            match: {
                                organizationSlug,
                            },
                        },
                        {
                            match: {
                                teamSlug,
                            },
                        },
                        {
                            match: {
                                entityId,
                            },
                        },
                        {
                            match: {
                                type,
                            },
                        },
                    ],
                },
            },
        }
        let res
        try {
            res = await axios(`${elasticsearchUrl}/${this.KYSO_INDEX}/_delete_by_query`, {
                method: 'post',
                data: query,
                headers: {
                    accept: 'application/json',
                    'content-type': 'application/json',
                },
            })
        } catch (ex) {
            Logger.log('Error', ex)
        }
        return res
    }

    public async indexDocument(kysoIndex: KysoIndex): Promise<any> {
        try {
            const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL)
            const url = `${elasticsearchUrl}/${this.KYSO_INDEX}/_doc?refresh=true`
            const response: AxiosResponse<any> = await axios.post(url, kysoIndex)
            if (response.status === 201) {
                return response.data
            } else {
                return null
            }
        } catch (e: any) {
            Logger.error(`An error occurred indexing an element of type '${kysoIndex.type}'`, e, FullTextSearchService.name)
            return null
        }
    }

    public async deleteAllDocumentsOfType(elasticSearchIndex: ElasticSearchIndex): Promise<any> {
        try {
            const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL)
            const url = `${elasticsearchUrl}/${this.KYSO_INDEX}/_delete_by_query`
            const response: AxiosResponse<any> = await axios.post(url, {
                query: {
                    match: {
                        type: elasticSearchIndex,
                    },
                },
            })
            if (response.status === 200) {
                Logger.log(`Deleted all documents for index ${elasticSearchIndex}`, FullTextSearchService.name)
                return response.data
            } else {
                return null
            }
        } catch (e: any) {
            Logger.error(`An error occurred deleting elements with type '${elasticSearchIndex}'`, e, FullTextSearchService.name)
            return null
        }
    }

    public async deleteDocument(type: ElasticSearchIndex, entityId: string): Promise<any> {
        try {
            const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL)
            const url = `${elasticsearchUrl}/${this.KYSO_INDEX}/_delete_by_query`
            const response: AxiosResponse<any> = await axios.post(url, {
                query: {
                    bool: {
                        must: [{ term: { type } }, { term: { entityId } }],
                    },
                },
            })
            if (response.status === 200) {
                return response.data
            } else {
                return null
            }
        } catch (e: any) {
            Logger.error(`An error occurred deleting element with id '${entityId}' of type '${type}'`, e, FullTextSearchService.name)
            return null
        }
    }

    public async updateDocument(kysoIndex: KysoIndex): Promise<any> {
        try {
            const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL)
            const url = `${elasticsearchUrl}/${this.KYSO_INDEX}/_update_by_query`
            const response: AxiosResponse<any> = await axios.post(url, {
                query: {
                    match: {
                        entityId: kysoIndex.entityId,
                    },
                },
                script: {
                    source: 'ctx._source = params.document',
                    params: {
                        document: kysoIndex,
                    },
                },
            })
            if (response.status === 200) {
                return response.data
            } else {
                return null
            }
        } catch (e: any) {
            Logger.error(`An error occurred updating element with id ${kysoIndex.entityId} of type ${kysoIndex.type}`, e, FullTextSearchService.name)
            return null
        }
    }

    public async updateReportFiles(kysoIndex: KysoIndex): Promise<any> {
        try {
            const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL)
            const url = `${elasticsearchUrl}/${this.KYSO_INDEX}/_update_by_query`
            const response: AxiosResponse<any> = await axios.post(url, {
                query: {
                    match: {
                        entityId: kysoIndex.entityId,
                    },
                },
                script: {
                    source: `ctx._source.title = '${kysoIndex.title}'; ctx._source.people = '${kysoIndex.people}'; ctx._source.tags = '${kysoIndex.tags}';`,
                    lang: 'painless',
                },
            })
            if (response.status === 200) {
                return response.data
            } else {
                return null
            }
        } catch (e: any) {
            Logger.error(`An error occurred updating elements with entityId ${kysoIndex.entityId} of type ${kysoIndex.type}`, e, FullTextSearchService.name)
            return null
        }
    }

    private getTerms(query: string, key: string): { slugs: string[]; newQuery: string } {
        if (query.includes(key)) {
            const parts: string[] = query.split(' ').filter((element: string) => element !== '')
            const index: number = parts.findIndex((element: string) => element.indexOf(key) > -1)
            const element: string = parts.splice(index, 1)[0]
            const slugs: string[] = element
                .replace(key, '')
                .split(',')
                .filter((element: string) => element !== '')
            return {
                slugs: slugs.length === 0 ? [] : slugs,
                newQuery: parts.join(' '),
            }
        } else {
            return {
                slugs: [],
                newQuery: query,
            }
        }
    }

    public async fullTextSearch(token: Token, searchTerms: string, page: number, perPage: number, type: ElasticSearchIndex): Promise<FullTextSearchDTO> {
        if (!page) {
            page = 1
        }
        if (!perPage) {
            perPage = 100
        }

        const organizationSlugs: { slugs: string[]; newQuery: string } = this.getTerms(searchTerms, 'org:')
        const teamSlugs: { slugs: string[]; newQuery: string } = this.getTerms(organizationSlugs.newQuery, 'team:')
        const emailSlugs: { slugs: string[]; newQuery: string } = this.getTerms(teamSlugs.newQuery, 'email:')
        const tagSlugs: { slugs: string[]; newQuery: string } = this.getTerms(emailSlugs.newQuery, 'tag:')
        searchTerms = tagSlugs.newQuery

        // Reports
        const reportsFullTextSearchMetadata: FullTextSearchMetadata = new FullTextSearchMetadata(0, 0, 0, 0)
        const reportsFullTextSearchResultType: FullTextSearchResultType = new FullTextSearchResultType([], [], [], [], reportsFullTextSearchMetadata)
        // Discussions
        const discussionsFullTextSearchMetadata: FullTextSearchMetadata = new FullTextSearchMetadata(0, 0, 0, 0)
        const discussionsFullTextSearchResultType: FullTextSearchResultType = new FullTextSearchResultType([], [], [], [], discussionsFullTextSearchMetadata)
        // Comments
        const commentsFullTextSearchMetadata: FullTextSearchMetadata = new FullTextSearchMetadata(0, 0, 0, 0)
        const commentsFullTextSearchResultType: FullTextSearchResultType = new FullTextSearchResultType([], [], [], [], commentsFullTextSearchMetadata)
        // Members
        const membersFullTextSearchMetadata: FullTextSearchMetadata = new FullTextSearchMetadata(0, 0, 0, 0)
        const membersFullTextSearchResultType: FullTextSearchResultType = new FullTextSearchResultType([], [], [], [], membersFullTextSearchMetadata)
        // Result
        const fullTextSearchDTO: FullTextSearchDTO = new FullTextSearchDTO(
            reportsFullTextSearchResultType,
            discussionsFullTextSearchResultType,
            commentsFullTextSearchResultType,
            membersFullTextSearchResultType,
        )

        // START: Filter by the organizations and teams that the user has access at this moment
        let filterTeams: string[] = []
        let filterOrganizations: string[] = []
        const filterPeople: string[] = emailSlugs.slugs
        const filterTags: string[] = tagSlugs.slugs

        if (organizationSlugs.slugs.length > 0) {
            for (const organizationSlug of organizationSlugs.slugs) {
                const organization: Organization = await this.organizationsService.getOrganization({ filter: { sluglified_name: organizationSlug } })
                if (!organization) {
                    continue
                }

                const teams: Team[] = await this.teamsService.getTeams({ filter: { organization_id: organization.id } })

                if (teamSlugs.slugs.length > 0) {
                    if (token) {
                        for (const teamSlug of teamSlugs.slugs) {
                            const index: number = token.permissions.teams.findIndex((t: ResourcePermissions) => t.name === teamSlug)
                            if (index !== -1) {
                                filterTeams.push(teamSlug)
                                continue
                            }
                            const indexTeamOrg: number = teams.findIndex((t: Team) => t.sluglified_name === teamSlug)
                            if (indexTeamOrg === -1) {
                                // the logged in user has filtered by a team of an organization for which he does not have permissions
                                return fullTextSearchDTO
                            }
                        }
                    } else {
                        const publicTeams: Team[] = teams.filter((team: Team) => team.visibility === TeamVisibilityEnum.PUBLIC)
                        for (const teamSlug of teamSlugs.slugs) {
                            const team: Team = publicTeams.find((t: Team) => t.sluglified_name === teamSlug)
                            if (team) {
                                filterTeams.push(teamSlug)
                            } else {
                                // the user not logged has filtered by team but that team is not public
                                return fullTextSearchDTO
                            }
                        }
                    }
                } else {
                    const index: number = filterOrganizations.indexOf(organizationSlug)
                    if (index === -1) {
                        filterOrganizations.push(organizationSlug)
                    }
                }
            }
        } else if (teamSlugs.slugs.length > 0) {
            for (const teamSlug of teamSlugs.slugs) {
                const team: Team = await this.teamsService.getTeam({ filter: { sluglified_name: teamSlug } })
                if (!team) {
                    continue
                }
                if (team.visibility === TeamVisibilityEnum.PUBLIC) {
                    const index: number = filterTeams.indexOf(teamSlug)
                    if (index === -1) {
                        filterTeams.push(team.sluglified_name)
                    }
                } else {
                    if (token) {
                        const index: number = token.permissions.teams.findIndex((permission: ResourcePermissions) => permission.name === team.sluglified_name)
                        if (index !== -1 || token.isGlobalAdmin()) {
                            const indexTeam: number = filterTeams.indexOf(teamSlug)
                            if (indexTeam === -1) {
                                filterTeams.push(team.sluglified_name)
                            }
                        }
                    } else {
                        // the user not logged has filtered by non-public team
                        return fullTextSearchDTO
                    }
                }
            }
        } else {
            if (token) {
                const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id)
                
                // All the teams of an user
                for (const team of teams) {
                    filterTeams.push(team.sluglified_name)
                }

                // All the organizations related to that teams
                const organizationIds: string[] = teams.map(x => x.organization_id);
                
                for(const orgId of organizationIds) {
                    const org: Organization = await this.organizationsService.getOrganizationById(orgId);
                    filterOrganizations.push(org.sluglified_name);
                }
            } else {
                const teams: Team[] = await this.teamsService.getTeams({ filter: { visibility: TeamVisibilityEnum.PUBLIC } })
                for (const team of teams) {
                    filterTeams.push(team.sluglified_name)
                }

                // All the organizations related to that teams
                const organizationIds: string[] = teams.map(x => x.organization_id);

                for(const orgId of organizationIds) {
                    const org: Organization = await this.organizationsService.getOrganizationById(orgId);
                    filterOrganizations.push(org.sluglified_name);
                }
            }
        }

        // Discard non-unique
        const uniqueTeams = new Set(filterTeams);
        filterTeams = Array.from(uniqueTeams);

        // Discard non-unique
        const uniqueOrganizations = new Set(filterOrganizations);
        filterOrganizations = Array.from(uniqueOrganizations);

        if (token && teamSlugs.slugs.length > 0 && filterTeams.length === 0) {
            // the logged user has filtered by team but that team is not in the permissions
            return fullTextSearchDTO
        }

        // END: Filter by the organizations and teams that the user has access at this moment
        if (filterTeams.length === 0) {
            return fullTextSearchDTO
        }

        const aggregateData: AggregateData = await this.aggregateData(token, searchTerms, filterOrganizations, filterTeams, filterPeople, filterTags)
        const aggregations: Aggregations = aggregateData.aggregations

        const searchResults: SearchData = await this.searchV2(
            token,
            searchTerms,
            type,
            page,
            perPage,
            filterOrganizations,
            filterTeams,
            filterPeople,
            filterTags,
        )

        // Reports
        if (aggregations?.type) {
            const typeBucket: TypeBucket = aggregations.type.buckets.find((tb: TypeBucket) => tb.key === ElasticSearchIndex.Report)
            if (typeBucket) {
                reportsFullTextSearchMetadata.total = typeBucket.doc_count
                reportsFullTextSearchMetadata.pages = Math.ceil(typeBucket.doc_count / perPage)
            }
            reportsFullTextSearchMetadata.page = page
            reportsFullTextSearchMetadata.perPage = Math.min(perPage, reportsFullTextSearchMetadata.total)
        }

        // Discussions
        if (aggregations?.type) {
            const typeBucket: TypeBucket = aggregations.type.buckets.find((tb: TypeBucket) => tb.key === ElasticSearchIndex.Discussion)
            if (typeBucket) {
                discussionsFullTextSearchMetadata.total = typeBucket.doc_count
                discussionsFullTextSearchMetadata.pages = Math.ceil(typeBucket.doc_count / perPage)
            }
            discussionsFullTextSearchMetadata.page = page
            discussionsFullTextSearchMetadata.perPage = Math.min(perPage, discussionsFullTextSearchMetadata.total)
        }

        // Comments
        if (aggregations?.type) {
            const typeBucket: TypeBucket = aggregations.type.buckets.find((tb: TypeBucket) => tb.key === ElasticSearchIndex.Comment)
            if (typeBucket) {
                commentsFullTextSearchMetadata.total = typeBucket.doc_count
                commentsFullTextSearchMetadata.pages = Math.ceil(typeBucket.doc_count / perPage)
            }
            commentsFullTextSearchMetadata.page = page
            commentsFullTextSearchMetadata.perPage = Math.min(perPage, commentsFullTextSearchMetadata.total)
        }

        // Members
        if (aggregations?.type) {
            const typeBucket: TypeBucket = aggregations.type.buckets.find((tb: TypeBucket) => tb.key === ElasticSearchIndex.User)
            if (typeBucket) {
                membersFullTextSearchMetadata.total = typeBucket.doc_count
                membersFullTextSearchMetadata.pages = Math.ceil(typeBucket.doc_count / perPage)
            }
            membersFullTextSearchMetadata.page = page
            membersFullTextSearchMetadata.perPage = Math.min(perPage, membersFullTextSearchMetadata.total)
        }

        if (aggregations?.type_organization) {
            aggregations.type_organization.buckets.forEach((aggregationBucket: AggregationBucket) => {
                if (aggregationBucket.key[0] === ElasticSearchIndex.Report) {
                    reportsFullTextSearchResultType.organizations.push(aggregationBucket.key[1])
                } else if (aggregationBucket.key[0] === ElasticSearchIndex.Discussion) {
                    discussionsFullTextSearchResultType.organizations.push(aggregationBucket.key[1])
                } else if (aggregationBucket.key[0] === ElasticSearchIndex.Comment) {
                    commentsFullTextSearchResultType.organizations.push(aggregationBucket.key[1])
                }
            })
        }
        if (aggregations?.type_team) {
            aggregations.type_team.buckets.forEach((aggregationBucket: AggregationBucket) => {
                if (aggregationBucket.key[0] === ElasticSearchIndex.Report) {
                    reportsFullTextSearchResultType.teams.push(aggregationBucket.key[1])
                } else if (aggregationBucket.key[0] === ElasticSearchIndex.Discussion) {
                    discussionsFullTextSearchResultType.teams.push(aggregationBucket.key[1])
                } else if (aggregationBucket.key[0] === ElasticSearchIndex.Comment) {
                    commentsFullTextSearchResultType.teams.push(aggregationBucket.key[1])
                }
            })
        }

        if (type === ElasticSearchIndex.Report) {
            reportsFullTextSearchResultType.results = searchResults.hits.hits.map((hit: Hit) => ({
                ...hit._source,
                score: hit._score,
                content: hit._source.content.length > 700 ? hit._source.content.substring(0, 700) + '...' : hit._source.content,
            }))
        } else if (type === ElasticSearchIndex.Discussion) {
            discussionsFullTextSearchResultType.results = searchResults.hits.hits.map((hit: Hit) => ({
                ...hit._source,
                score: hit._score,
                content: hit._source.content.length > 700 ? hit._source.content.substring(0, 700) + '...' : hit._source.content,
            }))
        } else if (type === ElasticSearchIndex.Comment) {
            commentsFullTextSearchResultType.results = searchResults.hits.hits.map((hit: Hit) => ({
                ...hit._source,
                score: hit._score,
                content: hit._source.content.length > 700 ? hit._source.content.substring(0, 700) + '...' : hit._source.content,
            }))
        } else if (type === ElasticSearchIndex.User) {
            membersFullTextSearchResultType.results = searchResults.hits.hits.map((hit: Hit) => ({
                ...hit._source,
                score: hit._score,
                content: hit._source.content.length > 700 ? hit._source.content.substring(0, 700) + '...' : hit._source.content,
            }))
        }

        return fullTextSearchDTO
    }

    private async aggregateData(
        token: Token,
        terms: string,
        filterOrgs: string[],
        filterTeams: string[],
        filterPeople: string[],
        filterTags: string[],
    ): Promise<AggregateData> {
        const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL)
        const url = `${elasticsearchUrl}/${this.KYSO_INDEX}/_search`
        const body: any = {
            size: 0,
            aggs: {
                // Group by type
                type: {
                    terms: {
                        field: 'type.keyword',
                    },
                },
                // Group by type and organization
                type_organization: {
                    multi_terms: {
                        terms: [
                            {
                                field: 'type.keyword',
                            },
                            {
                                field: 'organizationSlug.keyword',
                            },
                        ],
                    },
                },
                // Group by type and team
                type_team: {
                    multi_terms: {
                        terms: [
                            {
                                field: 'type.keyword',
                            },
                            {
                                field: 'teamSlug.keyword',
                            },
                        ],
                    },
                },
            },
            query: {
                bool: {
                    must: [],
                    filter: {
                        bool: {
                            should: [],
                            must: [],
                        },
                    },
                },
            },
        }

        if (!token) {
            body.query.bool.filter.bool.must.push({
                term: {
                    isPublic: true,
                },
            })
        }

        if (terms) {
            body.query.bool.must.push({
                query_string: {
                    default_field: 'content',
                    query: terms
                        .split(' ')
                        .map((term: string) => `*${term}*`)
                        .join(' '),
                },
            })
        }
        if (filterOrgs && filterOrgs.length > 0) {
            filterOrgs.forEach((organizationSlug: string) => {
                body.query.bool.filter.bool.should.push({
                    term: {
                        'organizationSlug.keyword': {
                            value: organizationSlug,
                        },
                    },
                })
            })
        }
        if (filterTeams && filterTeams.length > 0) {
            filterTeams.forEach((teamSlug: string) => {
                body.query.bool.filter.bool.should.push({
                    term: {
                        'teamSlug.keyword': {
                            value: teamSlug,
                        },
                    },
                })
            })
        }
        if (filterPeople && filterPeople.length > 0) {
            filterPeople.forEach((email: string) => {
                body.query.bool.filter.bool.must.push({
                    term: {
                        'people.keyword': {
                            value: email,
                        },
                    },
                })
            })
        }
        if (filterTags && filterTags.length > 0) {
            filterTags.forEach((tag: string) => {
                body.query.bool.filter.bool.must.push({
                    term: {
                        'tags.keyword': {
                            value: tag,
                        },
                    },
                })
            })
        }

        try {
            const response = await axios.post(url, body)
            return response.data
        } catch (e: any) {
            console.log(e.response.data.error)
            Logger.error(`Error while aggregating data`, e, FullTextSearchService.name)
            return null
        }
    }

    private async searchV2(
        token: Token,
        terms: string,
        entity: ElasticSearchIndex,
        page: number,
        perPage: number,
        filterOrgs: string[],
        filterTeams: string[],
        filterPeople: string[],
        filterTags: string[],
    ): Promise<SearchData> {
        const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL)
        const url = `${elasticsearchUrl}/${this.KYSO_INDEX}/_search`
        
        const body: any = {
            from: (page - 1) * perPage,
            size: perPage,
            query: {
                bool: {
                    must: [
                        { match: { content: { query: terms, operator: "AND" } } },    
                    ],
                    filter: [
                        { terms: { "organizationSlug.keyword": filterOrgs  } },
                        { terms: { "teamSlug.keyword": filterTeams  } }
                    ],
                },
            },
        }

        console.log(JSON.stringify(body));

        try {
            const response = await axios.post(url, body)
            return response.data
        } catch (e: any) {
            Logger.error(`Error while aggregating data`, e, FullTextSearchService.name)
            return null
        }
    }
}
