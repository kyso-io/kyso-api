import { ApiMethods, BaseModel, GitMetadata, StaticImplements } from '@kyso-io/kyso-model';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsMongoId, IsOptional, IsPositive, IsString } from 'class-validator';
import { IsFile, MemoryStoredFile } from 'nestjs-form-data';

export class CreateKysoReportVersionDto extends BaseModel implements StaticImplements<ApiMethods<CreateKysoReportVersionDto>, typeof CreateKysoReportVersionDto> {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  public version: number;

  @ApiProperty()
  @Transform(({ value }) => {
    try {
      return JSON.parse(value);
    } catch (e) {
      return [];
    }
  })
  @IsArray()
  @IsMongoId({ each: true })
  public unmodifiedFiles: string[];

  @ApiProperty()
  @Transform(({ value }) => {
    try {
      return JSON.parse(value);
    } catch (e) {
      return [];
    }
  })
  @IsArray()
  @IsMongoId({ each: true })
  public deletedFiles: string[];

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

  constructor(version: number, unmodifiedFiles: string[], deletedFiles: string[], file: MemoryStoredFile, message: string, git_metadata: GitMetadata) {
    super();
    this.version = version;
    this.unmodifiedFiles = unmodifiedFiles;
    this.deletedFiles = deletedFiles;
    this.file = file;
    this.message = message;
    this.git_metadata = git_metadata;
  }

  validate(): boolean {
    return true;
  }

  static createEmpty(): CreateKysoReportVersionDto {
    return new CreateKysoReportVersionDto(0, [], [], null, '', null);
  }

  static examples(): { [key: string]: { value: CreateKysoReportVersionDto } } {
    return {
      CreateKysoReportVersionDto: {
        value: CreateKysoReportVersionDto.createEmpty(),
      },
    };
  }
}
