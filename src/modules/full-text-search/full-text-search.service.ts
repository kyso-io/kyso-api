import { FullTextSearchDTO, FullTextSearchMetadata, FullTextSearchResult, FullTextSearchResultType } from '@kyso-io/kyso-model'
import { Injectable, Provider } from '@nestjs/common'
import axios from 'axios'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { KysoSettingsEnum } from '../kyso-settings/enums/kyso-settings.enum'
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service'


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
    @Autowired({ typeName: 'KysoSettingsService' })
    private kysoSettingsService: KysoSettingsService
    
    constructor() { 
        super()
    }

    public async search(terms: string, entity: string, page: number, perPage: number, 
        filterOrgs: string, filterTeams: string, filterTags: string, filterPeople: string): Promise<FullTextSearchDTO> {
        const elasticsearchUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL)
        
        // Calculate from
        const fromIndex = ((page - 1) * perPage)

        const res = await axios.post(
            `${elasticsearchUrl}/kyso-index/${entity}/_search`,
            {
                from: fromIndex, 
                size: perPage,
                query: {
                    match: {
                        content: terms,
                        organizationSlug: filterOrgs,
                        teamSlug: filterTeams, 
                        people: filterPeople,
                        tags: filterTags
                    }
                }
            }
        )

        // Retrieve aggregations
        const aggregations = await axios.post(
            `${elasticsearchUrl}/kyso-index/${entity}/_search`,
            {
                size: 0, 
                query: {
                    match: {
                        content: terms,
                        organizationSlug: filterOrgs,
                        teamSlug: filterTeams, 
                        people: filterPeople,
                        tags: filterTags
                    }
                },
                aggs: {
                    organizations: {
                        composite: {
                            sources: [
                                {
                                    name: {
                                        terms: {
                                            field: "organizationSlug.keyword"
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    teams: {
                        composite: {
                            sources: [
                                {
                                    name: {
                                        terms: {
                                            field: "teamSlug.keyword"
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    tags: {
                        composite: {
                            sources: [
                                {
                                    name: {
                                        terms: {
                                            field: "tags.keyword"
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    people: {
                        composite: {
                            sources: [
                                {
                                    name: {
                                        terms: {
                                            field: "people.keyword"
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        )

        const organizationsList = aggregations.data.aggregations.organizations.buckets.map(x => x.key.name)
        const teamsList = aggregations.data.aggregations.teams.buckets.map(x => x.key.name)
        // const peopleList = aggregations.data.aggregations.people.buckets.map(x => x.key.name)
        const tagsList = aggregations.data.aggregations.tags.buckets.map(x => x.key.name)
        
        const results: FullTextSearchResult[] = res.data.hits.hits.map(x => {
            return new FullTextSearchResult(x._source.title, x._source.content, x._source.link, x._source.type, x._source.people, 
                x._source.teamSlug, x._source.organizationSlug, x._source.tags, x._score)
        })

        const reportResult = new FullTextSearchResultType(results, organizationsList, teamsList, tagsList, 
            new FullTextSearchMetadata(page, Math.ceil(res.data.hits.total.value / perPage), perPage, res.data.hits.total.value))

        // We're not indexing that information for now, so always the results are 0 until is implemented
        const restOfResults = new FullTextSearchResultType([], [], [], [], 
            new FullTextSearchMetadata(1, 1, perPage, 0))

        return new FullTextSearchDTO(reportResult, restOfResults, restOfResults, restOfResults);
    }
}
