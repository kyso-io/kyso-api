import { InlineCommentStatusEnum } from '@kyso-io/kyso-model';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsMongoId, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';
import { IsDate } from '../../decorators/is-date.decorator';

export class SearchInlineCommentsQuery {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  public readonly limit: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  public readonly page: number;

  @ApiProperty()
  @IsEnum(['created_at', 'updated_at', 'status'])
  public readonly order_by: 'created_at' | 'updated_at' | 'status';

  @ApiProperty()
  @IsEnum(['asc', 'desc'])
  public readonly order_direction: 'asc' | 'desc';

  @ApiProperty()
  @IsOptional()
  @IsMongoId()
  public readonly report_author_id: string;

  @ApiProperty()
  @ValidateIf((o) => o.report_author_id)
  @IsIn(['eq', 'ne'])
  public readonly report_author_id_operator: 'eq' | 'ne';

  @ApiProperty()
  @IsOptional()
  @IsMongoId()
  public readonly inline_comment_author_id: string;

  @ApiProperty()
  @ValidateIf((o) => o.inline_comment_author_id)
  @IsIn(['eq', 'ne'])
  public readonly inline_comment_author_id_operator: 'eq' | 'ne';

  @ApiProperty()
  @IsOptional()
  @Transform(({ value }) =>
    value ? value.split(',').filter((v: any) => [InlineCommentStatusEnum.OPEN, InlineCommentStatusEnum.TO_DO, InlineCommentStatusEnum.DOING, InlineCommentStatusEnum.CLOSED].includes(v)) : [],
  )
  public readonly status: InlineCommentStatusEnum[];

  @ApiProperty()
  @ValidateIf((o) => o.status)
  @IsIn(['in', 'nin'])
  public readonly status_operator: 'in' | 'nin';

  @ApiProperty()
  @IsOptional()
  @IsMongoId()
  public readonly organization_id: string;

  @ApiProperty()
  @IsOptional()
  @IsMongoId()
  public readonly team_id: string;

  @ApiProperty()
  @ValidateIf((o) => o.team_id)
  @IsIn(['eq', 'ne'])
  public readonly team_id_operator: 'eq' | 'ne';

  @ApiProperty()
  @IsOptional()
  @IsString()
  public readonly text: string;

  @ApiProperty()
  @IsOptional()
  @IsDate('YYYY-MM-DD')
  public readonly start_date: string;

  @ApiProperty()
  @IsOptional()
  @IsDate('YYYY-MM-DD')
  public readonly end_date: string;

  @ApiProperty()
  @ValidateIf((o) => o.start_date)
  @IsIn(['lt', 'lte', 'eq', 'ne', 'gte', 'gt'])
  public readonly start_date_operator: 'lt' | 'lte' | 'eq' | 'ne' | 'gte' | 'gt';

  @ApiProperty()
  @ValidateIf((o) => o.end_date)
  @IsIn(['lt', 'lte', 'eq', 'ne', 'gte', 'gt'])
  public readonly end_date_operator: 'lt' | 'lte' | 'eq' | 'ne' | 'gte' | 'gt';
}
