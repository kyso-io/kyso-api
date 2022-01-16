import { ApiProperty } from '@nestjs/swagger'
import { BaseFilterQuery } from './base-filter.dto'

export class ReportFilterQuery extends BaseFilterQuery {
    @ApiProperty({
        title: 'Filter by owner',
        description: 'Return only reports belonging to the specified owner. Can be a user or a team',
        format: 'string',
        required: false,
    })
    owner: string

    @ApiProperty({
        title: 'Filter by pinned',
        description: 'Return only reports that are pinned',
        format: 'boolean',
        required: false,
    })
    pinned: boolean

    @ApiProperty({
        title: 'Filter by comma separated tags',
        description: 'Return only reports that has at least one the tags provided',
        format: 'string',
        required: false,
    })
    tags: string
}
