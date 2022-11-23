import { ApiMethods, StaticImplements } from '@kyso-io/kyso-model';
import { BaseDto } from '@kyso-io/kyso-model/dist/dtos/base.dto';
import { IsNotEmpty } from 'class-validator';
import { IsFile, MemoryStoredFile } from 'nestjs-form-data';

export class CreateThemeDto extends BaseDto implements StaticImplements<ApiMethods<CreateThemeDto>, typeof CreateThemeDto> {
  @IsNotEmpty()
  public name: string;

  @IsFile()
  public file: MemoryStoredFile;

  constructor(name: string, file: MemoryStoredFile) {
    super();
    this.name = name;
    this.file = file;
  }

  validate(): boolean {
    return true;
  }

  static createEmpty(): CreateThemeDto {
    return new CreateThemeDto('', null);
  }

  static examples(): { [key: string]: { value: CreateThemeDto } } {
    return {
      CreateThemeDto: {
        value: CreateThemeDto.createEmpty(),
      },
    };
  }
}
