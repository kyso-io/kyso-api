import { ApiProperty } from '@nestjs/swagger';

export class UpdateReportRequest {
  @ApiProperty({
    required: false
  })
  location: string;

  @ApiProperty({
    required: false
  })
  link: string;

  @ApiProperty({
    required: false
  })
  bio: string;
}