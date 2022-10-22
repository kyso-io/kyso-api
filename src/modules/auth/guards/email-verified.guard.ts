import { Token, User } from '@kyso-io/kyso-model';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Autowired } from '../../../decorators/autowired';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  @Autowired({ typeName: 'AuthService' })
  private readonly authService: AuthService;

  @Autowired({ typeName: 'UsersService' })
  private readonly usersService: UsersService;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: any = context.switchToHttp().getRequest();
    return this.validate(request);
  }

  public async validate(request: any): Promise<boolean> {
    if (!request.headers.hasOwnProperty('authorization') || request.headers['authorization'] === null || request.headers['authorization'] === '') {
      Logger.log('Missing authorization header');
      throw new ForbiddenException('Missing authorization header');
    }
    const tokenPayload: Token = this.authService.evaluateAndDecodeTokenFromHeader(request.headers.authorization);
    if (!tokenPayload) {
      Logger.log('Invalid jwt token');
      throw new ForbiddenException('Invalid jwt token');
    }
    const user: User = await this.usersService.getUserById(tokenPayload.id);
    if (!user) {
      Logger.log('User not found with this jwt token');
      throw new ForbiddenException('User not found with this jwt token');
    }
    if (!user.email_verified) {
      Logger.log('Email not verified');
      throw new ForbiddenException('Email not verified');
    }
    return true;
  }
}
