const aqp = require('api-query-params')
const { parse } = require('url')

const DEFAULT_LIMIT_VALUE = 30
const AQP_OPTIONS = {
    skipKey: 'page',
    limitKey: 'per_page',
}

export class QueryParser {
    static toQueryObject(queryString) {
        queryString = queryString
            .replace('created_at', '_created_at')
            .replace('updated_at', '_updated_at')

        const query = parse(queryString).query
        const result = query ? aqp(query, AQP_OPTIONS) : {}

        if (result.filter && result.filter.id) {
            result.filter._id = result.filter.id
            delete result.filter.id
        }

        if (!result.limit) result.limit = DEFAULT_LIMIT_VALUE
        if (result.skip) {
            result.skip = (result.skip - 1) * result.limit
        }

        return result
    }

    static createForeignKey(table, value) {
        return `${table}\$${value}`
    }
}
