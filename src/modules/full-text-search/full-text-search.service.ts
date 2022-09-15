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

    private calculateMetadata(type: string, page: number, perPage: number, metadata: any): FullTextSearchMetadata {
        if(metadata) {
            const numberOfReports = metadata.aggregations.type.buckets.filter(x => x.key === type);
            
            let total = 0;
            if(numberOfReports && numberOfReports.length > 0) {
                total = numberOfReports[0].doc_count;
            }

            return new FullTextSearchMetadata(
                page, Math.ceil(total/perPage), perPage, total)
        } else {
            return new FullTextSearchMetadata(1, 1, 10, 10);
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

        const requesterOrganizations = await this.organizationsService.getUserOrganizations(token.id);
        const requesterTeamsVisible = await this.teamsService.getTeamsVisibleForUser(token.id);
        const userBelongings = new Map<string, string[]>();

        for(const organization of requesterOrganizations) {
            const teams = requesterTeamsVisible.filter(x => x.organization_id === organization.id);
            
            if(teams) {
                userBelongings.set(organization.sluglified_name, teams.map(x => x.sluglified_name));
            }
        }

        const metadata = await this.searchCounters(searchTerms, userBelongings)
        
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
            userBelongings
        )

        if(searchResults) {
            reportsFullTextSearchResultType.metadata = this.calculateMetadata('report', page, perPage, metadata);
            discussionsFullTextSearchResultType.metadata = this.calculateMetadata('discussion', page, perPage, metadata);
            commentsFullTextSearchResultType.metadata = this.calculateMetadata('comment', page, perPage, metadata);
            membersFullTextSearchResultType.metadata = this.calculateMetadata('user', page, perPage, metadata);
        
            if (type === ElasticSearchIndex.Report) {
                reportsFullTextSearchResultType.results = searchResults.hits.hits.map((hit: any) => ({
                    ...hit._source,
                    score: hit._score,
                    content: hit.highlight && hit.highlight.content ? hit.highlight.content : ""
                }))
            } else if (type === ElasticSearchIndex.Discussion) {
                discussionsFullTextSearchResultType.results = searchResults.hits.hits.map((hit: any) => ({
                    ...hit._source,
                    score: hit._score,
                    // content: hit.highlight.content
                }))
            } else if (type === ElasticSearchIndex.Comment) {
                commentsFullTextSearchResultType.results = searchResults.hits.hits.map((hit: any) => ({
                    ...hit._source,
                    score: hit._score,
                    content: hit.highlight && hit.highlight.content ? hit.highlight.content : ""
                }))
            } else if (type === ElasticSearchIndex.User) {
                membersFullTextSearchResultType.results = searchResults.hits.hits.map((hit: any) => ({
                    ...hit._source,
                    score: hit._score,
                    // content: hit.highlight.content
                }))
            }
        }

        return fullTextSearchDTO
    }

    private async searchCounters(
        terms: string,
        userBelongings?: Map<string, string[]>,): Promise<any> {
        const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL)
        const url = `${elasticsearchUrl}/${this.KYSO_INDEX}/_search`
        
        const belongingsQuery = [];
        
        if(userBelongings) {
            for(const organization of userBelongings.keys()) {
                const queryTerm = {
                    bool: {
                        must: [
                            { term: { "organizationSlug.keyword": organization } },
                            { terms: { "teamSlug.keyword": userBelongings.get(organization) } }
                        ]
                    }
                }

                belongingsQuery.push(queryTerm);
            }
        }

        const body: any = {
            from: 1,
            size: 0,
            query: {
                bool: {
                    should: [
                        { match: { content: { query: terms, operator: "AND" } } },    
                    ],
                    filter: {
                        bool: {
                            should: [
                                { term: { isPublic: "true" } },
                            ]
                        }
                    }
                },
            },
            "aggs": {
                "type": {
                  "terms": {
                    "field": "type.keyword",
                    "size": 10000
                  }
                }   
            },
        }

        body.query.bool.filter.bool.should = [...body.query.bool.filter.bool.should, ...belongingsQuery];

        console.log(JSON.stringify(body));

        try {
            const response = await axios.post(url, body)
            return response.data
        } catch (e: any) {
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
        userBelongings?: Map<string, string[]>
    ): Promise<SearchData> {
        const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL)
        const url = `${elasticsearchUrl}/${this.KYSO_INDEX}/_search`
        
        const belongingsQuery = [];
        
        if(userBelongings) {
            for(const organization of userBelongings.keys()) {
                const queryTerm = {
                    bool: {
                        must: [
                            { term: { "organizationSlug.keyword": organization } },
                            { terms: { "teamSlug.keyword": userBelongings.get(organization) } }
                        ]
                    }
                }

                belongingsQuery.push(queryTerm);
            }
        }

        const body: any = {
            from: (page - 1) * perPage,
            size: perPage,
            query: {
                bool: {
                    should: [
                        { match: { content: { query: terms, operator: "AND" } } },    
                    ],
                    filter: {
                        bool: {
                            should: [
                                { term: { isPublic: "true" } },
                            ],
                            must: [ 
                                { terms: { "type.keyword": [entity] } },
                            ]
                        }
                    }
                },
            },
            _source: [
                "entityId", "filePath", "isPublic", "link", "organizationSlug", "people",
	            "tags", "teamSlug", "title", "type", "version"
            ],
            highlight : { 
                order : "score",
                fields : {
                  "content": { "number_of_fragments" : 1, "fragment_size" : 150 }
                }
            }
        }

        body.query.bool.filter.bool.should = [...body.query.bool.filter.bool.should, ...belongingsQuery];
        
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
