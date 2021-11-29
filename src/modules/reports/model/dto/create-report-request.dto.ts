import { ApiProperty } from '@nestjs/swagger';

class CreateReport {
  @ApiProperty({
    required: true,
    description: 'Git provider to retrieve the code',
    enum: ['github', 'gitlab', 'bitbucket'],
  })
  provider: string;

  @ApiProperty({
    required: true,
  })
  owner: string;

  @ApiProperty({
    required: true,
  })
  name: string;

  @ApiProperty({
    required: true,
  })
  default_branch: string;

  @ApiProperty({
    required: false,
  })
  path: string;
}

export class CreateReportRequest {
  @ApiProperty({
    required: false,
  })
  teams: string;

  @ApiProperty({
    required: true,
    type: CreateReport,
  })
  reports: CreateReport | CreateReport[];
}
