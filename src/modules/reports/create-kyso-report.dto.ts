import { IsOptional, IsString } from 'class-validator';
import { IsFile, MemoryStoredFile } from 'nestjs-form-data';

export class CreateKysoReportDto {
  @IsFile()
  public file: MemoryStoredFile;

  @IsOptional()
  @IsString()
  public message: string;
}
