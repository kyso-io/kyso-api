import { FullTextSearchDTO, FullTextSearchMetadata, FullTextSearchResult, FullTextSearchResultType } from '@kyso-io/kyso-model'
import { Injectable, Logger, Provider } from '@nestjs/common'
import axios from 'axios'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { KysoSettingsEnum } from '@kyso-io/kyso-model'
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

    private async buildFilter(terms: string[], type: string) {
        const finalTerms = terms.map(x => { 
            let res = { match: {} }
            res.match[type] = x
            return res
        })

        return {
            bool: {
                should: finalTerms
            }
        }
    }

    public async search(terms: string, entity: string, page: number, perPage: number, 
        filterOrgs: string, filterTeams: string, filterTags: string, filterPeople: string): Promise<FullTextSearchDTO> {
        const elasticsearchUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL)
        // Calculate from
        const fromIndex = ((page - 1) * perPage)

        const allOrgsToFilter: string[] = filterOrgs ? filterOrgs.split(',') : [];
        const allTeamsToFilter: string[] = filterTeams ? filterTeams.split(','): [];
        const allTagsToFilter: string[] = filterTags ? filterTags.split(','): [];
        const allPeopleToFilter: string[] = filterPeople ? filterPeople.split(','): [];

        const mappedTerms = terms.split(" ").map(x => '*' + x + '*')
        //console.log(mappedTerms)

        const joinedTerms = mappedTerms.join(" ")
        //console.log(joinedTerms)

        let query = {
            from: fromIndex,
            size: perPage,
            query: {
                bool: {
                    must: [
                        {
                            query_string: {
                                default_field: "content",
                                query: joinedTerms
                            }
                        }/*,
                        {
                            bool: {
                                must: [
                                    filterOrgs ? await this.buildFilter(allOrgsToFilter, "organizationSlug") : { match: { content: terms } }
                                    ,filterTeams ? await this.buildFilter(allTeamsToFilter, "teamSlug") : { match: { content: terms } }
                                    ,filterTags ? await this.buildFilter(allTagsToFilter, "tags") : { match: { content: terms } }
                                    ,filterPeople ? await this.buildFilter(allPeopleToFilter, "people") : { match: { content: terms } }
                                ]
                            }
                        }*/
                    ]
                }
            }
        };

        // console.log(JSON.stringify(query))


        let res
        try {
            res = await axios(
                `${elasticsearchUrl}/kyso-index/${entity}/_search`,
                {
                    method: "post", 
                    data: query, 
                    headers: {
                        'accept': "application/json",
                        'content-type': "application/json"
                    }
                }
            )
        } catch(ex) {
            Logger.log("Error", ex)
        }

        

        // Retrieve aggregations
        const aggregations = await axios.post(
            `${elasticsearchUrl}/kyso-index/${entity}/_search`,
            {
                size: 0, 
                query: {
                    match: {
                        content: terms
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
            return new FullTextSearchResult(x._source.title, 
                x._source.content.length > 700 ? x._source.content.substring(0, 700) + "..." : x._source.content, 
                x._source.link, x._source.type, x._source.people, 
                x._source.teamSlug, x._source.organizationSlug, x._source.tags, x._source.entityId,
                x._source.version, x._source.filePath, x._score)
        })

        const reportResult = new FullTextSearchResultType(results, organizationsList, teamsList, tagsList, 
            new FullTextSearchMetadata(page, Math.ceil(res.data.hits.total.value / perPage), perPage, res.data.hits.total.value))

        // We're not indexing that information for now, so always the results are 0 until is implemented
        const restOfResults = new FullTextSearchResultType([], [], [], [], 
            new FullTextSearchMetadata(1, 1, perPage, 0))

        return new FullTextSearchDTO(reportResult, restOfResults, restOfResults, restOfResults);
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
                                organizationSlug: organizationSlug
                            }
                        },
                        {
                            match: {
                                teamSlug: teamSlug
                            }
                        },
                        {
                            match: {
                                entityId: entityId
                            }
                        }
                    ]   
                }
            }
        };

        console.log(`${elasticsearchUrl}/kyso-index/${type}/_delete_by_query`)

        let res
        try {
            res = await axios(
                `${elasticsearchUrl}/kyso-index/${type}/_delete_by_query`,
                {
                    method: "post", 
                    data: query, 
                    headers: {
                        'accept': "application/json",
                        'content-type': "application/json"
                    }
                }
            )
        } catch(ex) {
            Logger.log("Error", ex)
        }

        return res
    }
}
