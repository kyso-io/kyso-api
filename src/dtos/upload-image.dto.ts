import { ApiMethods, StaticImplements } from '@kyso-io/kyso-model';
import { BaseDto } from '@kyso-io/kyso-model/dist/dtos/base.dto';
import { IsMongoId } from 'class-validator';
import { IsFile, MemoryStoredFile } from 'nestjs-form-data';

export class UploadImageDto extends BaseDto implements StaticImplements<ApiMethods<UploadImageDto>, typeof UploadImageDto> {
  @IsFile()
  public file: MemoryStoredFile;

  @IsMongoId()
  public userId: string;

  constructor(file: MemoryStoredFile, userId: string) {
    super();
    this.file = file;
    this.userId = userId;
  }

  validate(): boolean {
    return true;
  }

  static createEmpty(): UploadImageDto {
    return new UploadImageDto(null, null);
  }

  static examples(): { [key: string]: { value: UploadImageDto } } {
    return {
      UploadImageDto: {
        value: UploadImageDto.createEmpty(),
      },
    };
  }
}
