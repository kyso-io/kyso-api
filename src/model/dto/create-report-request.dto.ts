import { ApiProperty } from '@nestjs/swagger'

export class CreateReport {
    @ApiProperty({
        required: true,
        description: 'Git provider to retrieve the code',
        enum: ['github', 'gitlab', 'bitbucket'],
    })
    public provider: string

    @ApiProperty({
        required: true,
    })
    public owner: string

    @ApiProperty({
        required: true,
    })
    public name: string

    @ApiProperty({
        required: true,
    })
    public default_branch: string

    @ApiProperty({
        required: false,
    })
    public path: string

    @ApiProperty({
        required: true,
    })
    public team_id: string

    constructor(name: string, owner: string, provider: string, default_branch: string, path: string, team_id: string) {
        this.name = name
        this.owner = owner
        this.provider = provider
        this.default_branch = default_branch
        this.path = path
        this.team_id = team_id
    }
}

export class CreateReportRequest {
    @ApiProperty({
        required: false,
    })
    public teams: string

    @ApiProperty({
        required: true,
        type: CreateReport,
    })
    public reports: CreateReport | CreateReport[]
}
