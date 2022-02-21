export interface CreateBitbucketWebhookDto {
    url: string
    description: string
    events: string[]
    active: boolean
}
