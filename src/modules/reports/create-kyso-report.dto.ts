import { GitMetadata } from '@kyso-io/kyso-model';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { IsFile, MemoryStoredFile } from 'nestjs-form-data';

export class CreateKysoReportDto {
  @IsFile()
  public file: MemoryStoredFile;

  @IsOptional()
  @IsString()
  public message: string;

  @IsOptional()
  @Transform(({ value }) => {
    try {
      return JSON.parse(value);
    } catch (e) {
      return [];
    }
  })
  public git_metadata: GitMetadata;
}
