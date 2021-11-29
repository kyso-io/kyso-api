import { ApiProperty } from '@nestjs/swagger';

export class Hateoas {
  @ApiProperty()
  public api: string;
  @ApiProperty()
  public ui: string;
}
