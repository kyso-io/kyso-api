import { ApiProperty } from '@nestjs/swagger';

export class BaseFilterQuery {
  @ApiProperty({
    minimum: 1,
    title: 'Page',
    description: 'Allows skipping some elements for pagination purposes',
    exclusiveMaximum: true,
    exclusiveMinimum: true,
    format: 'int32',
    default: 1,
    required: false,
  })
  page: number;

  @ApiProperty({
    minimum: 1,
    maximum: 100,
    title: 'Items per page',
    description: 'Limits the amount of reports returned by the request',
    exclusiveMaximum: true,
    exclusiveMinimum: true,
    format: 'int32',
    default: 30,
    required: false,
  })
  per_page: number;

  @ApiProperty({
    title: 'Fields',
    description: 'Specify which fields of the reports will be returned',
    format: 'string',
    required: false,
  })
  fields: string;

  @ApiProperty({
    title: 'Sort by',
    description: 'Decide how the returned reports are sorted',
    format: 'string',
    required: false,
  })
  sort: string;
}
