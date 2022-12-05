import { ApiMethods, BaseModel, GitMetadata, StaticImplements, TableOfContentEntryDto } from '@kyso-io/kyso-model';
import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { IsFile, MemoryStoredFile } from 'nestjs-form-data';

export class CreateKysoReportDto extends BaseModel implements StaticImplements<ApiMethods<CreateKysoReportDto>, typeof CreateKysoReportDto> {
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

  @IsArray()
  public toc: TableOfContentEntryDto[];

  constructor(file: MemoryStoredFile, message: string, git_metadata: GitMetadata, toc: TableOfContentEntryDto[] = []) {
    super();
    this.file = file;
    this.message = message;
    this.git_metadata = git_metadata;
    this.toc = toc;
  }

  validate(): boolean {
    return true;
  }

  static createEmpty(): CreateKysoReportDto {
    return new CreateKysoReportDto(null, '', null, []);
  }

  static examples(): { [key: string]: { value: CreateKysoReportDto } } {
    return {
      CreateKysoReportDto: {
        value: CreateKysoReportDto.createEmpty(),
      },
    };
  }
}
