export interface GitlabWeebHook {
    id: number
    url: string
    project_id: number
    push_events: boolean
    push_events_branch_filter: string
    issues_events: boolean
    confidential_issues_events: boolean
    merge_requests_events: boolean
    tag_push_events: boolean
    note_events: boolean
    confidential_note_events: boolean
    job_events: boolean
    pipeline_events: boolean
    wiki_page_events: boolean
    deployment_events: boolean
    releases_events: boolean
    enable_ssl_verification: boolean
    created_at: Date
}
