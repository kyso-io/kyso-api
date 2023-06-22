import {
  ElasticSearchIndex,
  FullTextSearchAggregators,
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
  public static readonly KYSO_INDEX = 'kyso-index';

  @Autowired({ typeName: 'KysoSettingsService' })
  private kysoSettingsService: KysoSettingsService;

  @Autowired({ typeName: 'OrganizationsService' })
  private organizationsService: OrganizationsService;

  @Autowired({ typeName: 'TeamsService' })
  private teamsService: TeamsService;

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
      res = await axios(`${elasticsearchUrl}/${FullTextSearchService.KYSO_INDEX}/_delete_by_query`, {
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
      const url = `${elasticsearchUrl}/${FullTextSearchService.KYSO_INDEX}/_doc?refresh=true`;
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
      const url = `${elasticsearchUrl}/${FullTextSearchService.KYSO_INDEX}/_delete_by_query`;
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
      const url = `${elasticsearchUrl}/${FullTextSearchService.KYSO_INDEX}/_delete_by_query`;
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

  public async deleteDocumentsGivenTypeOrganizationAndTeam(type: ElasticSearchIndex, organizationSlug: string, teamSlug: string): Promise<any> {
    try {
      const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
      const url = `${elasticsearchUrl}/${FullTextSearchService.KYSO_INDEX}/_delete_by_query`;
      const response: AxiosResponse<any> = await axios.post(url, {
        query: {
          bool: {
            must: [{ term: { type } }, { term: { organizationSlug } }, { term: { teamSlug } }],
          },
        },
      });
      if (response.status === 200) {
        return response.data;
      } else {
        return null;
      }
    } catch (e: any) {
      Logger.error(`An error occurred deleting elements for type '${type}' organization '${organizationSlug}' and team '${teamSlug}'`, e, FullTextSearchService.name);
      return null;
    }
  }

  public async updateDocument(kysoIndex: KysoIndex): Promise<any> {
    try {
      const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
      const url = `${elasticsearchUrl}/${FullTextSearchService.KYSO_INDEX}/_update_by_query`;
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

  public async updateStarsInKysoIndex(entityId: string, stars: number): Promise<any> {
    try {
      const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
      const url = `${elasticsearchUrl}/${FullTextSearchService.KYSO_INDEX}/_update_by_query`;
      const response: AxiosResponse<any> = await axios.post(url, {
        query: {
          match: {
            entityId,
          },
        },
        script: {
          source: `ctx._source.stars = ${stars}`,
        },
      });
      if (response.status === 200) {
        return response.data;
      } else {
        return null;
      }
    } catch (e: any) {
      Logger.error(`An error occurred updating fields in element with id ${entityId}`, e, FullTextSearchService.name);
      return null;
    }
  }

  public async updateNumCommentsInKysoIndex(entityId: string, numComments: number): Promise<any> {
    try {
      const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
      const url = `${elasticsearchUrl}/${FullTextSearchService.KYSO_INDEX}/_update_by_query`;
      const response: AxiosResponse<any> = await axios.post(url, {
        query: {
          match: {
            entityId,
          },
        },
        script: {
          source: `ctx._source.numComments = ${numComments}`,
        },
      });
      if (response.status === 200) {
        return response.data;
      } else {
        return null;
      }
    } catch (e: any) {
      Logger.error(`An error occurred updating fields in element with id ${entityId}`, e, FullTextSearchService.name);
      return null;
    }
  }

  public async updateNumTasksInKysoIndex(entityId: string, numTasks: number): Promise<any> {
    try {
      const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
      const url = `${elasticsearchUrl}/${FullTextSearchService.KYSO_INDEX}/_update_by_query`;
      const response: AxiosResponse<any> = await axios.post(url, {
        query: {
          match: {
            entityId,
          },
        },
        script: {
          source: `ctx._source.numTasks = ${numTasks}`,
        },
      });
      if (response.status === 200) {
        return response.data;
      } else {
        return null;
      }
    } catch (e: any) {
      Logger.error(`An error occurred updating fields in element with id ${entityId}`, e, FullTextSearchService.name);
      return null;
    }
  }

  public async updateReportFiles(kysoIndex: KysoIndex): Promise<any> {
    try {
      const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
      const url = `${elasticsearchUrl}/${FullTextSearchService.KYSO_INDEX}/_update_by_query`;
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

  public async fullTextSearch(
    token: Token,
    searchTerms: string,
    page: number,
    perPage: number,
    type: ElasticSearchIndex,
    filterOrganizations: string[],
    filterTeams: string[],
    filterPeople: string[],
    filterTags: string[],
    filterFiles: string[],
    orderBy: string,
    order: string,
  ): Promise<FullTextSearchDTO> {
    if (!page) {
      page = 1;
    }
    if (!perPage) {
      perPage = 100;
    }

    // Reports
    const reportsFullTextSearchMetadata: FullTextSearchMetadata = new FullTextSearchMetadata(0, 0, 0, 0, FullTextSearchAggregators.createEmpty());
    const reportsFullTextSearchResultType: FullTextSearchResultType = new FullTextSearchResultType([], reportsFullTextSearchMetadata);

    // Discussions
    const discussionsFullTextSearchMetadata: FullTextSearchMetadata = new FullTextSearchMetadata(0, 0, 0, 0, FullTextSearchAggregators.createEmpty());
    const discussionsFullTextSearchResultType: FullTextSearchResultType = new FullTextSearchResultType([], discussionsFullTextSearchMetadata);

    // Comments
    const commentsFullTextSearchMetadata: FullTextSearchMetadata = new FullTextSearchMetadata(0, 0, 0, 0, FullTextSearchAggregators.createEmpty());
    const commentsFullTextSearchResultType: FullTextSearchResultType = new FullTextSearchResultType([], commentsFullTextSearchMetadata);

    // Members
    const membersFullTextSearchMetadata: FullTextSearchMetadata = new FullTextSearchMetadata(0, 0, 0, 0, FullTextSearchAggregators.createEmpty());
    const membersFullTextSearchResultType: FullTextSearchResultType = new FullTextSearchResultType([], membersFullTextSearchMetadata);

    // Inline Comments
    const inlineCommentsFullTextSearchMetadata: FullTextSearchMetadata = new FullTextSearchMetadata(0, 0, 0, 0, FullTextSearchAggregators.createEmpty());
    const inlineCommentsFullTextSearchResultType: FullTextSearchResultType = new FullTextSearchResultType([], inlineCommentsFullTextSearchMetadata);

    // Result
    const fullTextSearchDTO: FullTextSearchDTO = new FullTextSearchDTO(
      reportsFullTextSearchResultType,
      discussionsFullTextSearchResultType,
      commentsFullTextSearchResultType,
      membersFullTextSearchResultType,
      inlineCommentsFullTextSearchResultType,
    );

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
    let requesterOrganizations: Organization[] = await this.organizationsService.getOrganizations({
      filter: {
        _id: { $in: uniqueOrganizationIds.map((id: string) => new ObjectId(id)) },
      },
    });
    if (filterOrganizations.length > 0) {
      requesterOrganizations = requesterOrganizations.filter((x: Organization) => filterOrganizations.includes(x.sluglified_name));
    }
    const userBelongings = new Map<string, string[]>();
    for (const organization of requesterOrganizations) {
      if (filterTeams.length > 0) {
        const orgTeams: string[] = filterTeams.filter((x: string) => x.startsWith(`${organization.sluglified_name}_`));
        if (orgTeams.length > 0) {
          const teams: Team[] = requesterTeamsVisible.filter((x: Team) => x.organization_id === organization.id && orgTeams.includes(`${organization.sluglified_name}_${x.sluglified_name}`));
          if (teams.length > 0) {
            userBelongings.set(
              organization.sluglified_name,
              teams.map((x: Team) => x.sluglified_name),
            );
          }
        }
      } else {
        const teams: Team[] = requesterTeamsVisible.filter((x: Team) => x.organization_id === organization.id);
        if (teams.length > 0) {
          userBelongings.set(
            organization.sluglified_name,
            teams.map((x: Team) => x.sluglified_name),
          );
        }
      }
    }

    const searchResults: SearchData = await this.searchResults(searchTerms, type, page, perPage, filterPeople, filterTags, filterFiles, orderBy, order, userBelongings);
    if (searchResults) {
      switch (type) {
        case ElasticSearchIndex.Report:
          reportsFullTextSearchResultType.results = searchResults.hits.hits.map((hit: any) => {
            let source: any = { ...hit._source };
            if (hit?.inner_hits?.max_version?.hits?.hits.length > 0) {
              source = { ...source, ...hit.inner_hits.max_version.hits.hits[0]._source };
            }
            return {
              ...source,
              score: hit._score,
              content: hit.highlight && hit.highlight.content ? hit.highlight.content : '',
            };
          });
          break;
        case ElasticSearchIndex.Discussion:
          discussionsFullTextSearchResultType.results = searchResults.hits.hits.map((hit: any) => ({
            ...hit._source,
            score: hit._score,
          }));
          break;
        case ElasticSearchIndex.Comment:
          commentsFullTextSearchResultType.results = searchResults.hits.hits.map((hit: any) => ({
            ...hit._source,
            score: hit._score,
            content: hit.highlight && hit.highlight.content ? hit.highlight.content : '',
          }));
          break;
        case ElasticSearchIndex.User:
          membersFullTextSearchResultType.results = searchResults.hits.hits.map((hit: any) => ({
            ...hit._source,
            score: hit._score,
          }));
          break;
        case ElasticSearchIndex.InlineComment:
          inlineCommentsFullTextSearchResultType.results = searchResults.hits.hits.map((hit: any) => ({
            ...hit._source,
            score: hit._score,
            content: hit.highlight && hit.highlight.content ? hit.highlight.content : '',
          }));
          break;
        default:
          break;
      }
    }

    const metadataReports: any = await this.searchCountersReports(searchTerms, filterPeople, filterTags, filterFiles, userBelongings);
    this.fillPaginationData(ElasticSearchIndex.Report, reportsFullTextSearchResultType.metadata, page, perPage, metadataReports);
    this.fillAggregators(reportsFullTextSearchResultType.metadata.aggregators, metadataReports);

    const metadataComments: any = await this.searchCountersComments(searchTerms, filterPeople, userBelongings);
    this.fillPaginationData(ElasticSearchIndex.Comment, commentsFullTextSearchResultType.metadata, page, perPage, metadataComments);
    this.fillAggregators(commentsFullTextSearchResultType.metadata.aggregators, metadataComments);

    const metadataInlineComments: any = await this.searchCountersInlineComments(searchTerms, filterPeople, userBelongings);
    this.fillPaginationData(ElasticSearchIndex.InlineComment, inlineCommentsFullTextSearchResultType.metadata, page, perPage, metadataInlineComments);
    this.fillAggregators(inlineCommentsFullTextSearchResultType.metadata.aggregators, metadataInlineComments);

    return fullTextSearchDTO;
  }

  private fillAggregators(aggregators: FullTextSearchAggregators, metadata: any): void {
    if (metadata?.aggregations?.organization?.buckets?.length > 0) {
      metadata.aggregations.organization.buckets.forEach((bucket: { key: string; doc_count: number; collapsed_hits?: { value: number } }) => {
        aggregators.organizations.push({
          key: bucket.key,
          doc_count: bucket.collapsed_hits ? bucket.collapsed_hits.value : bucket.doc_count,
        });
      });
    }
    if (metadata?.aggregations?.organization_team?.buckets?.length > 0) {
      metadata.aggregations['organization_team'].buckets.forEach((bucket: { key: string; doc_count: number; collapsed_hits?: { value: number } }) => {
        aggregators.teams.push({
          key: bucket.key,
          doc_count: bucket.collapsed_hits ? bucket.collapsed_hits.value : bucket.doc_count,
        });
      });
    }
    if (metadata?.aggregations?.people?.buckets?.length > 0) {
      metadata.aggregations.people.buckets.forEach((bucket: { key: string; doc_count: number; collapsed_hits?: { value: number } }) => {
        aggregators.people.push({
          key: bucket.key,
          doc_count: bucket.collapsed_hits ? bucket.collapsed_hits.value : bucket.doc_count,
        });
      });
    }
    if (metadata?.aggregations?.tags?.buckets?.length > 0) {
      metadata.aggregations.tags.buckets.forEach((bucket: { key: string; doc_count: number; collapsed_hits?: { value: number } }) => {
        aggregators.tags.push({
          key: bucket.key,
          doc_count: bucket.collapsed_hits ? bucket.collapsed_hits.value : bucket.doc_count,
        });
      });
    }
    if (metadata?.aggregations?.file_type?.buckets?.length > 0) {
      metadata.aggregations.file_type.buckets.forEach((bucket: { key: string; doc_count: number; collapsed_hits?: { value: number } }) => {
        aggregators.file_types.push({
          key: bucket.key,
          doc_count: bucket.collapsed_hits ? bucket.collapsed_hits.value : bucket.doc_count,
        });
      });
    }
  }

  private fillPaginationData(elasticSearchIndex: ElasticSearchIndex, fullTextSearchMetadata: FullTextSearchMetadata, page: number, perPage: number, metadata: any): void {
    switch (elasticSearchIndex) {
      case ElasticSearchIndex.Report:
        fullTextSearchMetadata.page = page;
        fullTextSearchMetadata.perPage = perPage;
        fullTextSearchMetadata.total = metadata.aggregations.collapsed_hits.value;
        fullTextSearchMetadata.pages = Math.ceil(fullTextSearchMetadata.total / perPage);
        break;
      case ElasticSearchIndex.Comment:
      case ElasticSearchIndex.InlineComment:
      case ElasticSearchIndex.Discussion:
      case ElasticSearchIndex.User:
        fullTextSearchMetadata.page = page;
        fullTextSearchMetadata.perPage = perPage;
        fullTextSearchMetadata.total = metadata.hits.total.value;
        fullTextSearchMetadata.pages = Math.ceil(fullTextSearchMetadata.total / perPage);
        break;
      default:
        break;
    }
  }

  private async searchCountersReports(terms: string, filterPeople: string[], filterTags: string[], filterFiles: string[], userBelongings?: Map<string, string[]>): Promise<any> {
    const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
    const url = `${elasticsearchUrl}/${FullTextSearchService.KYSO_INDEX}/_search`;

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
              should: belongingsQuery,
              must: [{ terms: { 'type.keyword': [ElasticSearchIndex.Report] } }],
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
        organization: {
          terms: {
            field: 'organizationSlug.keyword',
          },
          aggs: {
            collapsed_hits: {
              cardinality: {
                field: 'fileRef.keyword',
              },
            },
          },
        },
        organization_team: {
          terms: {
            script: {
              source: "return doc['organizationSlug.keyword'].value + '_' + doc['teamSlug.keyword'].value;",
            },
          },
          aggs: {
            collapsed_hits: {
              cardinality: {
                field: 'fileRef.keyword',
              },
            },
          },
        },
        tags: {
          terms: {
            field: 'tags.keyword',
          },
          aggs: {
            collapsed_hits: {
              cardinality: {
                field: 'fileRef.keyword',
              },
            },
          },
        },
        people: {
          terms: {
            field: 'people.keyword',
          },
          aggs: {
            collapsed_hits: {
              cardinality: {
                field: 'fileRef.keyword',
              },
            },
          },
        },
        file_type: {
          terms: {
            script: {
              source:
                "if (doc['fileRef.keyword'].size() == 0) { return ''; } String filename = doc['fileRef.keyword'].value; int lastDotIndex = filename.lastIndexOf('.'); if (lastDotIndex > 0) { return filename.substring(lastDotIndex + 1); } else { return ''; }",
            },
          },
          aggs: {
            collapsed_hits: {
              cardinality: {
                field: 'fileRef.keyword',
              },
            },
          },
        },
      },
    };

    if (filterPeople.length > 0) {
      body.query.bool.filter.bool.must.push({ terms: { 'people.keyword': filterPeople } });
    }
    if (filterTags.length > 0) {
      body.query.bool.filter.bool.must.push({ terms: { 'tags.keyword': filterTags } });
    }
    if (filterFiles.length > 0) {
      filterFiles.forEach((extension: string) => {
        body.query.bool.filter.bool.must.push({ wildcard: { 'fileRef.keyword': `*.${extension}` } });
      });
    }

    try {
      const response = await axios.post(url, body);
      return response.data;
    } catch (e: any) {
      Logger.error(`Error while aggregating data`, e, FullTextSearchService.name);
      return null;
    }
  }

  private async searchCountersComments(terms: string, filterPeople: string[], userBelongings?: Map<string, string[]>): Promise<any> {
    const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
    const url = `${elasticsearchUrl}/${FullTextSearchService.KYSO_INDEX}/_search`;

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
              should: belongingsQuery,
              must: [{ terms: { 'type.keyword': [ElasticSearchIndex.Comment] } }],
            },
          },
        },
      },
      aggs: {
        organization: {
          terms: {
            field: 'organizationSlug.keyword',
          },
        },
        organization_team: {
          terms: {
            script: {
              source: "return doc['organizationSlug.keyword'].value + '_' + doc['teamSlug.keyword'].value;",
            },
          },
        },
        people: {
          terms: {
            field: 'people.keyword',
          },
        },
      },
    };

    if (filterPeople.length > 0) {
      body.query.bool.filter.bool.must.push({ terms: { 'people.keyword': filterPeople } });
    }

    try {
      const response = await axios.post(url, body);
      return response.data;
    } catch (e: any) {
      Logger.error(`Error while aggregating data`, e, FullTextSearchService.name);
      return null;
    }
  }

  private async searchCountersInlineComments(terms: string, filterPeople: string[], userBelongings?: Map<string, string[]>): Promise<any> {
    const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
    const url = `${elasticsearchUrl}/${FullTextSearchService.KYSO_INDEX}/_search`;

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
              should: belongingsQuery,
              must: [{ terms: { 'type.keyword': [ElasticSearchIndex.InlineComment] } }],
            },
          },
        },
      },
      aggs: {
        organization: {
          terms: {
            field: 'organizationSlug.keyword',
          },
        },
        organization_team: {
          terms: {
            script: {
              source: "return doc['organizationSlug.keyword'].value + '_' + doc['teamSlug.keyword'].value;",
            },
          },
        },
        people: {
          terms: {
            field: 'people.keyword',
          },
        },
      },
    };

    if (filterPeople.length > 0) {
      body.query.bool.filter.bool.must.push({ terms: { 'people.keyword': filterPeople } });
    }

    try {
      const response = await axios.post(url, body);
      return response.data;
    } catch (e: any) {
      Logger.error(`Error while aggregating data`, e, FullTextSearchService.name);
      return null;
    }
  }

  private async searchResults(
    terms: string,
    entity: ElasticSearchIndex,
    page: number,
    perPage: number,
    filterPeople: string[],
    filterTags: string[],
    filterFiles: string[],
    orderBy: string,
    order: string,
    userBelongings?: Map<string, string[]>,
  ): Promise<SearchData> {
    const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
    const url = `${elasticsearchUrl}/${FullTextSearchService.KYSO_INDEX}/_search`;

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
              should: belongingsQuery,
              must: [],
            },
          },
        },
      },
      highlight: {
        order: 'score',
        fields: {
          content: { number_of_fragments: 1, fragment_size: 150, max_analyzed_offset: 99999 },
        },
      },
      sort: [
        {
          [orderBy]: order,
        },
      ],
    };

    // Add collapse for reports
    if (entity === ElasticSearchIndex.Report) {
      body._source = false;
      body.collapse = {
        field: 'fileRef.keyword',
        inner_hits: {
          name: 'max_version',
          size: 1,
          sort: [{ version: 'desc' }],
        },
      };
      if (filterTags.length > 0) {
        body.query.bool.filter.bool.must.push({ terms: { 'tags.keyword': filterTags } });
      }
      if (filterFiles.length > 0) {
        filterFiles.forEach((extension: string) => {
          body.query.bool.filter.bool.must.push({ wildcard: { 'fileRef.keyword': `*.${extension}` } });
        });
      }
    }

    if (filterPeople.length > 0) {
      body.query.bool.filter.bool.must.push({ terms: { 'people.keyword': filterPeople } });
    }

    try {
      const response = await axios.post(url, body);
      return response.data;
    } catch (e: any) {
      Logger.error(`Error searching data`, e, FullTextSearchService.name);
      return null;
    }
  }

  public async getDocumentsGivenTypeOrgSlugAndTeamSlug(type: ElasticSearchIndex, organizationSlug: string, teamSlug: string, page: number, size: number): Promise<any> {
    try {
      const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
      const url = `${elasticsearchUrl}/${FullTextSearchService.KYSO_INDEX}/_search`;
      const response: AxiosResponse<any> = await axios.post(url, {
        query: {
          bool: {
            must: [
              {
                term: {
                  type: {
                    value: type,
                  },
                },
              },
              {
                term: {
                  'organizationSlug.keyword': {
                    value: organizationSlug,
                  },
                },
              },
              {
                term: {
                  'teamSlug.keyword': {
                    value: teamSlug,
                  },
                },
              },
            ],
          },
        },
        from: (page - 1) * size,
        size,
      });
      if (response.status === 200) {
        return response.data;
      } else {
        return null;
      }
    } catch (e: any) {
      Logger.error(`An error occurred requesting elements for type ${type} organization ${organizationSlug} team ${teamSlug} page ${page} size ${size}`, e, FullTextSearchService.name);
      return null;
    }
  }

  public async bulk(documents: any[]): Promise<any> {
    try {
      const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
      const url = `${elasticsearchUrl}/_bulk?refresh=true`;
      const body: string = documents.map((e: any) => JSON.stringify(e)).join('\n') + '\n';
      const response: AxiosResponse<any> = await axios.post(url, body, {
        headers: { 'Content-Type': 'application/x-ndjson' },
      });
      if (response.status === 200) {
        return response.data;
      } else {
        return null;
      }
    } catch (e) {
      Logger.error(`An error occurred indexing documents`, e, FullTextSearchService.name);
      return null;
    }
  }

  public async removeField(fieldName: string): Promise<any> {
    try {
      const elasticsearchUrl: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.ELASTICSEARCH_URL);
      const url = `${elasticsearchUrl}/${FullTextSearchService.KYSO_INDEX}/_update_by_query?refresh=true`;
      const response: AxiosResponse<any> = await axios.post(url, {
        script: {
          inline: `ctx._source.remove('${fieldName}')`,
        },
      });
      if (response.status === 200) {
        return response.data;
      } else {
        return null;
      }
    } catch (e) {
      Logger.error(`An error occurred removing field ${fieldName}`, e, FullTextSearchService.name);
      return null;
    }
  }
}
