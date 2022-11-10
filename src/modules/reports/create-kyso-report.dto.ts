import { ApiMethods, BaseModel, GitMetadata, StaticImplements } from '@kyso-io/kyso-model';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
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

  constructor(file: MemoryStoredFile, message: string, git_metadata: GitMetadata) {
    super();
    this.file = file;
    this.message = message;
    this.git_metadata = git_metadata;
  }

  validate(): boolean {
    return true;
  }

  static createEmpty(): CreateKysoReportDto {
    return new CreateKysoReportDto(null, '', null);
  }

  static examples(): { [key: string]: { value: CreateKysoReportDto } } {
    return {
      CreateKysoReportDto: {
        value: CreateKysoReportDto.createEmpty(),
      },
    };
  }
}
