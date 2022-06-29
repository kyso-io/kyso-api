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
import { writeFileSync } from 'fs'
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

    public async deleteIndexedResults(organizationSlug: string, teamSlug: string, entityId: string, type: string): Promise<any> {
        Logger.log(`Deleting indexed data for ${organizationSlug} and ${teamSlug} and ${entityId} for ${type}`)

        const elasticsearchUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL)

        let query = {
            query: {
                bool: {
                    must: [
                        {
                            match: {
                                organizationSlug: organizationSlug,
                            },
                        },
                        {
                            match: {
                                teamSlug: teamSlug,
                            },
                        },
                        {
                            match: {
                                entityId: entityId,
                            },
                        },
                    ],
                },
            },
        }

        let res
        try {
            res = await axios(`${elasticsearchUrl}/${this.KYSO_INDEX}/${type}/_delete_by_query`, {
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

    public async fullTextSearch(
        token: Token,
        searchTerms: string,
        page: number,
        perPage: number,
        type: ElasticSearchIndex,
        filterTags: string,
        filterOrganizationsStr: string,
        filterTeamsStr: string,
        filterPeople: string,
    ): Promise<FullTextSearchDTO> {
        if (!page) {
            page = 1
        }
        if (!perPage) {
            perPage = 100
        }

        const filterTeams: string[] = []
        const filterOrganizations: string[] = []

        if (filterOrganizationsStr) {
            for (const organizationSlug of filterOrganizationsStr.split(',')) {
                const indexOrganization: number = filterOrganizations.findIndex((org) => org === organizationSlug)
                if (indexOrganization !== -1) {
                    continue
                }

                const organization: Organization = await this.organizationsService.getOrganization({ filter: { sluglified_name: organizationSlug } })
                if (!organization) {
                    continue
                }

                const teams: Team[] = await this.teamsService.getTeams({ filter: { organization_id: organization.id } })
                const publicTeams: Team[] = teams.filter((team: Team) => team.visibility === TeamVisibilityEnum.PUBLIC)
                if (publicTeams.length > 0 || (token && token.isGlobalAdmin())) {
                    filterOrganizations.push(organizationSlug)
                    for (const teamSlug of publicTeams) {
                        filterTeams.push(teamSlug.sluglified_name)
                    }
                } else if (token) {
                    const index: number = token.permissions.organizations.findIndex((org: ResourcePermissions) => org.name === organization.sluglified_name)
                    if (index !== -1 || token.isGlobalAdmin()) {
                        filterOrganizations.push(organizationSlug)
                    }
                }
            }
        }

        if (filterTeamsStr) {
            for (const teamSlug of filterTeamsStr.split(',')) {
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
                    }
                }
            }
        } else {
            if (token) {
                for (const team of token.permissions.teams) {
                    const index: number = filterTeams.indexOf(team.name)
                    if (index === -1) {
                        filterTeams.push(team.name)
                    }
                }
            }
        }

        const aggregateData: AggregateData = await this.aggregateData(token, searchTerms, filterOrganizations, filterTeams)
        const aggregations: Aggregations = aggregateData.aggregations

        const searchResults: SearchData = await this.searchV2(token, searchTerms, type, page, perPage, filterOrganizations, filterTeams)

        // Reports
        const reportsFullTextSearchMetadata: FullTextSearchMetadata = new FullTextSearchMetadata(0, 0, 0, 0)
        const reportsFullTextSearchResultType: FullTextSearchResultType = new FullTextSearchResultType([], [], [], [], reportsFullTextSearchMetadata)
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
        const discussionsFullTextSearchMetadata: FullTextSearchMetadata = new FullTextSearchMetadata(0, 0, 0, 0)
        const discussionsFullTextSearchResultType: FullTextSearchResultType = new FullTextSearchResultType([], [], [], [], discussionsFullTextSearchMetadata)
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
        const commentsFullTextSearchMetadata: FullTextSearchMetadata = new FullTextSearchMetadata(0, 0, 0, 0)
        const commentsFullTextSearchResultType: FullTextSearchResultType = new FullTextSearchResultType([], [], [], [], commentsFullTextSearchMetadata)
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
        const membersFullTextSearchMetadata: FullTextSearchMetadata = new FullTextSearchMetadata(0, 0, 0, 0)
        const membersFullTextSearchResultType: FullTextSearchResultType = new FullTextSearchResultType([], [], [], [], membersFullTextSearchMetadata)
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

        const fullTextSearchDTO: FullTextSearchDTO = new FullTextSearchDTO(
            reportsFullTextSearchResultType,
            discussionsFullTextSearchResultType,
            commentsFullTextSearchResultType,
            membersFullTextSearchResultType,
        )
        return fullTextSearchDTO
    }

    private async aggregateData(token: Token, terms: string, filterOrgs: string[], filterTeams: string[]): Promise<AggregateData> {
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
                        },
                    },
                },
            },
        }

        if (!token || !token.isGlobalAdmin()) {
            body.query.bool.filter.bool.should.push({
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
        try {
            const response = await axios.post(url, body)
            writeFileSync('aggregate.json', JSON.stringify(response.data, null, 2))
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
    ): Promise<SearchData> {
        const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL)
        const url = `${elasticsearchUrl}/${this.KYSO_INDEX}/_search`
        const body: any = {
            from: (page - 1) * perPage,
            size: perPage,
            query: {
                bool: {
                    must: [],
                    filter: {
                        bool: {
                            should: [],
                        },
                    },
                },
            },
        }
        if (!token || !token.isGlobalAdmin()) {
            body.query.bool.filter.bool.should.push({
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
        if (entity) {
            body.query.bool.must.push({
                term: {
                    type: entity,
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
        try {
            const response = await axios.post(url, body)
            writeFileSync('search.json', JSON.stringify(response.data, null, 2))
            return response.data
        } catch (e: any) {
            Logger.error(`Error while aggregating data`, e, FullTextSearchService.name)
            return null
        }
    }
}
