import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserRequest {
  @ApiProperty()
  public email: string;
  @ApiProperty()
  public nickname: string;
  @ApiProperty()
  public bio: string;
  @ApiProperty({
    description:
      'Github access token, if the user uses github as authentication provider',
    required: false,
  })
  public access_token?: string;
}
