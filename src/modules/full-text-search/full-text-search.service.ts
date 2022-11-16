import {
  ElasticSearchIndex,
  FullTextSearchDTO,
  FullTextSearchMetadata,
  FullTextSearchResultType,
  KysoIndex,
  KysoSettingsEnum,
  Organization,
  Team,
  TeamVisibilityEnum,
  Token,
} from '@kyso-io/kyso-model';
import { Injectable, Logger, Provider } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { ObjectId } from 'mongodb';
import { Autowired } from '../../decorators/autowired';
import { AutowiredService } from '../../generic/autowired.generic';
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { TeamsService } from '../teams/teams.service';
import { SearchData } from './search-data';

function factory(service: FullTextSearchService) {
  return service;
}

export function createProvider(): Provider<FullTextSearchService> {
  return {
    provide: `${FullTextSearchService.name}`,
    useFactory: (service) => factory(service),
    inject: [FullTextSearchService],
  };
}

@Injectable()
export class FullTextSearchService extends AutowiredService {
  private readonly KYSO_INDEX = 'kyso-index';

  @Autowired({ typeName: 'KysoSettingsService' })
  private kysoSettingsService: KysoSettingsService;

  @Autowired({ typeName: 'OrganizationsService' })
  private organizationsService: OrganizationsService;

  @Autowired({ typeName: 'TeamsService' })
  private teamsService: TeamsService;

  constructor() {
    super();
  }

  public async deleteIndexedResults(organizationSlug: string, teamSlug: string, entityId: string, type: ElasticSearchIndex): Promise<any> {
    Logger.log(`Deleting indexed data for ${organizationSlug} and ${teamSlug} and ${entityId} for ${type}`);
    const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
    const query = {
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
    };
    let res;
    try {
      res = await axios(`${elasticsearchUrl}/${this.KYSO_INDEX}/_delete_by_query`, {
        method: 'post',
        data: query,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
      });
    } catch (ex) {
      Logger.log('Error', ex);
    }
    return res;
  }

  public async indexDocument(kysoIndex: KysoIndex): Promise<any> {
    try {
      const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
      const url = `${elasticsearchUrl}/${this.KYSO_INDEX}/_doc?refresh=true`;
      const response: AxiosResponse<any> = await axios.post(url, kysoIndex);
      if (response.status === 201) {
        return response.data;
      } else {
        return null;
      }
    } catch (e: any) {
      Logger.error(`An error occurred indexing an element of type '${kysoIndex.type}'`, e, FullTextSearchService.name);
      return null;
    }
  }

  public async deleteAllDocumentsOfType(elasticSearchIndex: ElasticSearchIndex): Promise<any> {
    try {
      const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
      const url = `${elasticsearchUrl}/${this.KYSO_INDEX}/_delete_by_query`;
      const response: AxiosResponse<any> = await axios.post(url, {
        query: {
          match: {
            type: elasticSearchIndex,
          },
        },
      });
      if (response.status === 200) {
        Logger.log(`Deleted all documents for index ${elasticSearchIndex}`, FullTextSearchService.name);
        return response.data;
      } else {
        return null;
      }
    } catch (e: any) {
      Logger.error(`An error occurred deleting elements with type '${elasticSearchIndex}'`, e, FullTextSearchService.name);
      return null;
    }
  }

  public async deleteDocument(type: ElasticSearchIndex, entityId: string): Promise<any> {
    try {
      const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
      const url = `${elasticsearchUrl}/${this.KYSO_INDEX}/_delete_by_query`;
      const response: AxiosResponse<any> = await axios.post(url, {
        query: {
          bool: {
            must: [{ term: { type } }, { term: { entityId } }],
          },
        },
      });
      if (response.status === 200) {
        return response.data;
      } else {
        return null;
      }
    } catch (e: any) {
      Logger.error(`An error occurred deleting element with id '${entityId}' of type '${type}'`, e, FullTextSearchService.name);
      return null;
    }
  }

  public async updateDocument(kysoIndex: KysoIndex): Promise<any> {
    try {
      const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
      const url = `${elasticsearchUrl}/${this.KYSO_INDEX}/_update_by_query`;
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
      });
      if (response.status === 200) {
        return response.data;
      } else {
        return null;
      }
    } catch (e: any) {
      Logger.error(`An error occurred updating element with id ${kysoIndex.entityId} of type ${kysoIndex.type}`, e, FullTextSearchService.name);
      return null;
    }
  }

  public async updateReportFiles(kysoIndex: KysoIndex): Promise<any> {
    try {
      const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
      const url = `${elasticsearchUrl}/${this.KYSO_INDEX}/_update_by_query`;
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
      });
      if (response.status === 200) {
        return response.data;
      } else {
        return null;
      }
    } catch (e: any) {
      Logger.error(`An error occurred updating elements with entityId ${kysoIndex.entityId} of type ${kysoIndex.type}`, e, FullTextSearchService.name);
      return null;
    }
  }

  private getTerms(query: string, key: string): { slugs: string[]; newQuery: string } {
    if (query.includes(key)) {
      const parts: string[] = query.split(' ').filter((element: string) => element !== '');
      const index: number = parts.findIndex((element: string) => element.indexOf(key) > -1);
      const element: string = parts.splice(index, 1)[0];
      const slugs: string[] = element
        .replace(key, '')
        .split(',')
        .filter((element: string) => element !== '');
      return {
        slugs: slugs.length === 0 ? [] : slugs,
        newQuery: parts.join(' '),
      };
    } else {
      return {
        slugs: [],
        newQuery: query,
      };
    }
  }

  private calculateMetadata(type: string, page: number, perPage: number, metadata: any): FullTextSearchMetadata {
    if (metadata) {
      const bucketData = metadata.aggregations.type.buckets.filter((x) => x.key === type);
      let total = 0;
      if (bucketData && bucketData.length > 0) {
        if (type == 'report') {
          total = bucketData[0].collapsed_hits.value;
        } else {
          total = bucketData[0].doc_count;
        }
      }
      return new FullTextSearchMetadata(page, Math.ceil(total / perPage), perPage, total);
    } else {
      return new FullTextSearchMetadata(0, 0, 0, 0);
    }
  }

  public async fullTextSearch(token: Token, searchTerms: string, page: number, perPage: number, type: ElasticSearchIndex): Promise<FullTextSearchDTO> {
    if (!page) {
      page = 1;
    }
    if (!perPage) {
      perPage = 100;
    }

    const organizationSlugs: { slugs: string[]; newQuery: string } = this.getTerms(searchTerms, 'org:');
    const teamSlugs: { slugs: string[]; newQuery: string } = this.getTerms(organizationSlugs.newQuery, 'team:');
    const emailSlugs: { slugs: string[]; newQuery: string } = this.getTerms(teamSlugs.newQuery, 'email:');
    const tagSlugs: { slugs: string[]; newQuery: string } = this.getTerms(emailSlugs.newQuery, 'tag:');
    searchTerms = tagSlugs.newQuery;

    // Reports
    const reportsFullTextSearchMetadata: FullTextSearchMetadata = new FullTextSearchMetadata(0, 0, 0, 0);
    const reportsFullTextSearchResultType: FullTextSearchResultType = new FullTextSearchResultType([], [], [], [], reportsFullTextSearchMetadata);

    // Discussions
    const discussionsFullTextSearchMetadata: FullTextSearchMetadata = new FullTextSearchMetadata(0, 0, 0, 0);
    const discussionsFullTextSearchResultType: FullTextSearchResultType = new FullTextSearchResultType([], [], [], [], discussionsFullTextSearchMetadata);

    // Comments
    const commentsFullTextSearchMetadata: FullTextSearchMetadata = new FullTextSearchMetadata(0, 0, 0, 0);
    const commentsFullTextSearchResultType: FullTextSearchResultType = new FullTextSearchResultType([], [], [], [], commentsFullTextSearchMetadata);

    // Members
    const membersFullTextSearchMetadata: FullTextSearchMetadata = new FullTextSearchMetadata(0, 0, 0, 0);
    const membersFullTextSearchResultType: FullTextSearchResultType = new FullTextSearchResultType([], [], [], [], membersFullTextSearchMetadata);

    // Result
    const fullTextSearchDTO: FullTextSearchDTO = new FullTextSearchDTO(
      reportsFullTextSearchResultType,
      discussionsFullTextSearchResultType,
      commentsFullTextSearchResultType,
      membersFullTextSearchResultType,
    );

    // START: Filter by the organizations and teams that the user has access at this moment
    const filterTeams: string[] = [];
    const filterOrganizations: string[] = [];
    const filterPeople: string[] = emailSlugs.slugs;
    const filterTags: string[] = tagSlugs.slugs;

    let requesterTeamsVisible: Team[] = [];
    // For users get their organizations and teams, for users not logged in
    // compute public teams and organizations
    if (token) {
      requesterTeamsVisible = await this.teamsService.getTeamsVisibleForUser(token.id);
    } else {
      requesterTeamsVisible = await this.teamsService.getTeams({
        filter: {
          visibility: TeamVisibilityEnum.PUBLIC,
        },
      });
    }

    const uniqueOrganizationIds: string[] = [];
    if (requesterTeamsVisible.length > 0) {
      requesterTeamsVisible.forEach((team: Team) => {
        if (!uniqueOrganizationIds.includes(team.organization_id)) {
          uniqueOrganizationIds.push(team.organization_id);
        }
      });
    }
    const requesterOrganizations: Organization[] = await this.organizationsService.getOrganizations({
      filter: {
        _id: { $in: uniqueOrganizationIds.map((id: string) => new ObjectId(id)) },
      },
    });

    const userBelongings = new Map<string, string[]>();
    for (const organization of requesterOrganizations) {
      const teams: Team[] = requesterTeamsVisible.filter((x: Team) => x.organization_id === organization.id);
      if (teams.length > 0) {
        userBelongings.set(
          organization.sluglified_name,
          teams.map((x: Team) => x.sluglified_name),
        );
      }
    }

    const metadata = await this.searchCounters(searchTerms, userBelongings);

    const searchResults: SearchData = await this.searchV2(token, searchTerms, type, page, perPage, filterOrganizations, filterTeams, filterPeople, filterTags, userBelongings);

    if (searchResults) {
      reportsFullTextSearchResultType.metadata = this.calculateMetadata('report', page, perPage, metadata);
      discussionsFullTextSearchResultType.metadata = this.calculateMetadata('discussion', page, perPage, metadata);
      commentsFullTextSearchResultType.metadata = this.calculateMetadata('comment', page, perPage, metadata);
      membersFullTextSearchResultType.metadata = this.calculateMetadata('user', page, perPage, metadata);

      if (type === ElasticSearchIndex.Report) {
        reportsFullTextSearchResultType.results = searchResults.hits.hits.map((hit: any) => ({
          ...hit._source,
          score: hit._score,
          content: hit.highlight && hit.highlight.content ? hit.highlight.content : '',
        }));
      } else if (type === ElasticSearchIndex.Discussion) {
        discussionsFullTextSearchResultType.results = searchResults.hits.hits.map((hit: any) => ({
          ...hit._source,
          score: hit._score,
          // content: hit.highlight.content
        }));
      } else if (type === ElasticSearchIndex.Comment) {
        commentsFullTextSearchResultType.results = searchResults.hits.hits.map((hit: any) => ({
          ...hit._source,
          score: hit._score,
          content: hit.highlight && hit.highlight.content ? hit.highlight.content : '',
        }));
      } else if (type === ElasticSearchIndex.User) {
        membersFullTextSearchResultType.results = searchResults.hits.hits.map((hit: any) => ({
          ...hit._source,
          score: hit._score,
          // content: hit.highlight.content
        }));
      }
    }

    return fullTextSearchDTO;
  }

  private async searchCounters(terms: string, userBelongings?: Map<string, string[]>): Promise<any> {
    const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
    const url = `${elasticsearchUrl}/${this.KYSO_INDEX}/_search`;

    const belongingsQuery = [];

    if (userBelongings) {
      for (const organization of userBelongings.keys()) {
        const queryTerm = {
          bool: {
            must: [{ term: { 'organizationSlug.keyword': organization } }, { terms: { 'teamSlug.keyword': userBelongings.get(organization) } }],
          },
        };

        belongingsQuery.push(queryTerm);
      }
    }

    // Don't do the query if we don't have an orgs/teams filter
    if (belongingsQuery.length == 0) {
      return null;
    }

    const body: any = {
      from: 0,
      size: 0,
      query: {
        bool: {
          must: [{ match: { content: { query: terms, operator: 'AND' } } }],
          filter: {
            bool: {
              minimum_should_match: 1,
              should: [],
            },
          },
        },
      },
      collapse: {
        field: 'fileRef.keyword',
        inner_hits: {
          name: 'max_version',
          size: 1,
          sort: [{ version: 'desc' }],
          _source: false,
        },
      },
      aggs: {
        collapsed_hits: {
          cardinality: { field: 'fileRef.keyword' },
        },
        type: {
          terms: {
            field: 'type.keyword',
            size: 10000,
          },
          aggs: {
            collapsed_hits: {
              cardinality: { field: 'fileRef.keyword' },
            },
          },
        },
      },
    };

    body.query.bool.filter.bool.should = [...body.query.bool.filter.bool.should, ...belongingsQuery];

    console.log(JSON.stringify(body));

    try {
      const response = await axios.post(url, body);
      return response.data;
    } catch (e: any) {
      Logger.error(`Error while aggregating data`, e, FullTextSearchService.name);
      return null;
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
    userBelongings?: Map<string, string[]>,
  ): Promise<SearchData> {
    const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
    const url = `${elasticsearchUrl}/${this.KYSO_INDEX}/_search`;

    const belongingsQuery = [];

    if (userBelongings) {
      for (const organization of userBelongings.keys()) {
        const queryTerm = {
          bool: {
            must: [{ term: { 'organizationSlug.keyword': organization } }, { terms: { 'teamSlug.keyword': userBelongings.get(organization) } }],
          },
        };

        belongingsQuery.push(queryTerm);
      }
    }

    // Don't do the query if we don't have an orgs/teams filter
    if (belongingsQuery.length == 0) {
      return null;
    }

    const body: any = {
      from: (page - 1) * perPage,
      size: perPage,
      query: {
        bool: {
          must: [{ match: { content: { query: terms, operator: 'AND' } } }, { terms: { 'type.keyword': [entity] } }],
          filter: {
            bool: {
              minimum_should_match: 1,
              should: [],
            },
          },
        },
      },
      _source: ['entityId', 'filePath', 'isPublic', 'link', 'organizationSlug', 'people', 'tags', 'teamSlug', 'title', 'type', 'version'],
      highlight: {
        order: 'score',
        fields: {
          content: { number_of_fragments: 1, fragment_size: 150, max_analyzed_offset: 99999 },
        },
      },
    };

    // Add collapse for reports
    if (entity === ElasticSearchIndex.Report) {
      body.collapse = {
        field: 'fileRef.keyword',
        inner_hits: {
          name: 'max_version',
          size: 1,
          sort: [{ version: 'desc' }],
          _source: false,
        },
      };
    }

    body.query.bool.filter.bool.should = [...body.query.bool.filter.bool.should, ...belongingsQuery];

    console.log(JSON.stringify(body));

    try {
      const response = await axios.post(url, body);
      return response.data;
    } catch (e: any) {
      Logger.error(`Error searching data`, e, FullTextSearchService.name);
      return null;
    }
  }
}
