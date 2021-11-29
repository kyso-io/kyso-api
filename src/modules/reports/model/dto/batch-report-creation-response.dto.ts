import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import { Hateoas } from 'src/model/hateoas.model';

export class BatchReportCreation {
  @ApiProperty({
    required: true,
    enum: ['ERROR', 'OK'],
  })
  status: string;

  @ApiProperty({
    required: false,
  })
  reason: string;

  @ApiProperty({
    required: false,
  })
  self_url: Hateoas;
}
