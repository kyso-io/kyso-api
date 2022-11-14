import { Token, User } from '@kyso-io/kyso-model';
import { ForbiddenException, Logger } from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';

export const checkJwtTokenInGuard = async (authService: AuthService, usersService: UsersService, request: any): Promise<User> => {
  if (!request.headers.hasOwnProperty('authorization') || request.headers['authorization'] === null || request.headers['authorization'] === '') {
    Logger.log('Missing authorization header');
    throw new ForbiddenException('Missing authorization header');
  }
  const tokenPayload: Token = authService.evaluateAndDecodeTokenFromHeader(request.headers.authorization);
  if (!tokenPayload) {
    Logger.log('Invalid jwt token');
    throw new ForbiddenException('Invalid jwt token');
  }
  const user: User = await usersService.getUserById(tokenPayload.id);
  if (!user) {
    Logger.log('User not found with this jwt token');
    throw new ForbiddenException('User not found with this jwt token');
  }
  return user;
};
