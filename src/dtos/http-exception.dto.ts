import { ApiProperty } from '@nestjs/swagger';

export class HttpExceptionDto {
  @ApiProperty({ type: Number })
  public statusCode: number;

  @ApiProperty({ type: String })
  public error: string;

  @ApiProperty({ type: String })
  public message: string;

  // @ApiProperty({ type: [String] })
  public extendedMessage?: string[];

  // @ApiProperty({ type: String })
  public method?: string;

  // @ApiProperty({ type: String })
  public path?: string;

  // @ApiProperty({ type: String })
  public timestamp?: string;

  constructor(statusCode: number, error: string, message: string) {
    this.statusCode = statusCode;
    this.error = error;
    this.message = message;
  }
}
