import { Token } from '@kyso-io/kyso-model';

export interface DecodedToken {
  exp: number;
  iat: number;
  iss: string;
  payload: Token;
}
