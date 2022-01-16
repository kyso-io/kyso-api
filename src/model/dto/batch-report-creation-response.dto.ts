import { ApiProperty } from '@nestjs/swagger'

export class BatchReportCreation {
    @ApiProperty({
        required: true,
        enum: ['ERROR', 'OK'],
    })
    status: string

    @ApiProperty({
        required: false,
    })
    reason: string
}
