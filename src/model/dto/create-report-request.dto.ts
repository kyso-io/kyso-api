import { ApiProperty } from '@nestjs/swagger'

export class CreateReport {
    @ApiProperty({
        required: true,
        description: 'Git provider to retrieve the code',
        enum: ['github', 'gitlab', 'bitbucket'],
    })
    provider: string

    @ApiProperty({
        required: true,
    })
    owner: string

    @ApiProperty({
        required: true,
    })
    name: string

    @ApiProperty({
        required: true,
    })
    default_branch: string

    @ApiProperty({
        required: false,
    })
    path: string

    constructor(name, owner, provider, default_branch, path) {
        this.name = name
        this.owner = owner
        this.provider = provider
        this.default_branch = default_branch
        this.path = path
    }
}

export class CreateReportRequest {
    @ApiProperty({
        required: false,
    })
    teams: string

    @ApiProperty({
        required: true,
        type: CreateReport,
    })
    reports: CreateReport | CreateReport[]
}
