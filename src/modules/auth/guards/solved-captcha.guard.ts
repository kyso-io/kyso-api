import { KysoSettingsEnum, User } from '@kyso-io/kyso-model';
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { KysoSettingsService } from 'src/modules/kyso-settings/kyso-settings.service';
import { Autowired } from '../../../decorators/autowired';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';
import { checkJwtTokenInGuard } from './check-jwt-token';

@Injectable()
export class SolvedCaptchaGuard implements CanActivate {
  @Autowired({ typeName: 'AuthService' })
  private readonly authService: AuthService;

  @Autowired({ typeName: 'UsersService' })
  private readonly usersService: UsersService;

  @Autowired({ typeName: 'KysoSettingsService' })
  private readonly kysoSettingsService: KysoSettingsService;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: any = context.switchToHttp().getRequest();
    return this.validate(request);
  }

  public async validate(request: any): Promise<boolean> {
    const user: User = await checkJwtTokenInGuard(this.authService, this.usersService, request);
    const captchaEnabled: boolean = (await this.kysoSettingsService.getValue(KysoSettingsEnum.HCAPTCHA_ENABLED)) === 'true' ? true : false;
    if (captchaEnabled && user.show_captcha) {
      Logger.log('Captcha not solved');
      throw new ForbiddenException('Captcha not solved');
    }
    return true;
  }
}
