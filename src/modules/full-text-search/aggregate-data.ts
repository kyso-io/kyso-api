export interface AggregateData {
    took: number
    timed_out: boolean
    _shards: Shards
    hits: Hits
    aggregations: Aggregations
}

export interface Shards {
    total: number
    successful: number
    skipped: number
    failed: number
}

export interface Aggregations {
    type_organization: TypeOrganizationClass
    type_team: TypeOrganizationClass
    type: TypeClass
}

export interface TypeClass {
    doc_count_error_upper_bound: number
    sum_other_doc_count: number
    buckets: TypeBucket[]
}

export interface TypeBucket {
    key: string
    doc_count: number
}

export interface TypeOrganizationClass {
    doc_count_error_upper_bound: number
    sum_other_doc_count: number
    buckets: AggregationBucket[]
}

export interface AggregationBucket {
    key: string[]
    key_as_string: string
    doc_count: number
}

export interface Hits {
    total: Total
    max_score: null
    hits: any[]
}

export interface Total {
    value: number
    relation: string
}
