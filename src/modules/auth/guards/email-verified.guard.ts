import { User } from '@kyso-io/kyso-model';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Autowired } from '../../../decorators/autowired';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';
import { checkJwtTokenInGuard } from './check-jwt-token';

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
    const user: User = await checkJwtTokenInGuard(this.authService, this.usersService, request);
    if (!user.email_verified) {
      Logger.log('Email not verified');
      throw new ForbiddenException('Email not verified');
    }
    return true;
  }
}
