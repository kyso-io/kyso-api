import { ApiProperty } from '@nestjs/swagger';
import { BaseModel } from './base.model';

export class Team extends BaseModel {
  @ApiProperty()
  public id: string;

  @ApiProperty()
  public name: string;
  @ApiProperty()
  public avatar_url: string;
  @ApiProperty()
  public bio: string;
  @ApiProperty()
  public link: string;
  @ApiProperty()
  public location: string;
}
