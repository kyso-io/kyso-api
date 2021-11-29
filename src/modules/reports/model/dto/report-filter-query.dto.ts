import { ApiProperty } from '@nestjs/swagger';
import { BaseFilterQuery } from 'src/model/dto/base-filter.dto';

export class ReportFilterQuery extends BaseFilterQuery {
  @ApiProperty({
    title: 'Filter by owner',
    description:
      'Return only reports belonging to the specified owner. Can be a user or a team',
    format: 'string',
    required: false,
  })
  owner: string;
}
