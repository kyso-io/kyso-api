/* eslint-disable @typescript-eslint/no-var-requires */
const aqp = require('api-query-params');
const { parse } = require('url');

const DEFAULT_LIMIT_VALUE = 30;
const AQP_OPTIONS = {
  skipKey: 'page',
  limitKey: 'per_page',
};

export class QueryParser {
  static toQueryObject(queryString) {
    const query = parse(queryString).query;
    const result = query ? aqp(query, AQP_OPTIONS) : {};

    if (result.filter && result.filter.id) {
      result.filter._id = result.filter.id;
      delete result.filter.id;
    }

    if (result.filter.limit) {
      result.limit = result.filter.limit;
      delete result.filter.limit;
    } else if (!result.limit) {
      result.limit = DEFAULT_LIMIT_VALUE;
    }

    if (result.skip) {
      result.skip = (result.skip - 1) * result.limit;
    }

    if (result.filter?.search) {
      result.filter['$text'] = { $search: result.filter.search };
      delete result.filter.search;
    }

    return result;
  }

  static createForeignKey(table, value) {
    return `${table}\$${value}`;
  }
}
