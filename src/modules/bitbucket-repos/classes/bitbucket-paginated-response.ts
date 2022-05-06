export interface BitbucketPaginatedResponse<T> {
    pagelen: number
    values: T[]
    page: number
    size: number
}
