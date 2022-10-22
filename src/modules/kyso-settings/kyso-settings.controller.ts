import { GlobalPermissionsEnum, KysoSetting, KysoSettingsEnum, NormalizedResponseDTO, Token } from '@kyso-io/kyso-model';
import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
import { Public } from '../../decorators/is-public';
import { GenericController } from '../../generic/controller.generic';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { Permission } from '../auth/annotations/permission.decorator';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { SolvedCaptchaGuard } from '../auth/guards/solved-captcha.guard';
import { KysoSettingsService } from './kyso-settings.service';

const PUBLIC_KYSO_SETTINGS: KysoSettingsEnum[] = [
  KysoSettingsEnum.AUTH_BITBUCKET_CLIENT_ID,
  KysoSettingsEnum.AUTH_GITHUB_CLIENT_ID,
  KysoSettingsEnum.AUTH_GITLAB_CLIENT_ID,
  KysoSettingsEnum.AUTH_GOOGLE_CLIENT_ID,
  KysoSettingsEnum.AUTH_GITLAB_REDIRECT_URI,
  KysoSettingsEnum.AUTH_PINGID_SAML_SSO_URL,
  KysoSettingsEnum.HCAPTCHA_SITE_KEY,
  KysoSettingsEnum.KYSO_FILES_CLOUDFRONT_URL,
  KysoSettingsEnum.HCAPTCHA_ENABLED,
  KysoSettingsEnum.BASE_URL,
  KysoSettingsEnum.BITBUCKET_API,
  KysoSettingsEnum.STATIC_CONTENT_PREFIX,
  KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_BITBUCKET,
  KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_GITLAB,
  KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_GITHUB,
  KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_GOOGLE,
  KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_KYSO,
  KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_PINGID_SAML,
  KysoSettingsEnum.UNAUTHORIZED_REDIRECT_URL,
  KysoSettingsEnum.CUSTOMIZE_LOGIN_CENTRAL_LOGO_URL,
  KysoSettingsEnum.CUSTOMIZE_LOGIN_CENTRAL_REDIRECT_URL,
  KysoSettingsEnum.CUSTOMIZE_LOGIN_LEFT_LOGO_URL,
  KysoSettingsEnum.CUSTOMIZE_LOGIN_LEFT_REDIRECT_URL,
  KysoSettingsEnum.CUSTOMIZE_LOGIN_RIGHT_LOGO_URL,
  KysoSettingsEnum.CUSTOMIZE_LOGIN_RIGHT_REDIRECT_URL,
  KysoSettingsEnum.CUSTOMIZE_LOGIN_CSS_STYLES,
  KysoSettingsEnum.CUSTOMIZE_LOGIN_LINK_CSS_STYLES,
  KysoSettingsEnum.CUSTOMIZE_LOGIN_HEADER_CSS_STYLES,
  KysoSettingsEnum.CUSTOMIZE_LOGIN_SHOWDIV_CSS_STYLES,
  KysoSettingsEnum.CUSTOMIZE_LOGIN_HIDDENDIV_CSS_STYLES,
  KysoSettingsEnum.CUSTOMIZE_LOGIN_BUTTON_HOVER_CSS_STYLES,
  KysoSettingsEnum.CUSTOMIZE_LOGIN_BUTTON_CSS_STYLES,
  KysoSettingsEnum.MAX_FILE_SIZE,
];

@ApiTags('kyso-settings')
@ApiExtraModels(KysoSetting)
@ApiBearerAuth()
@Controller('kyso-settings')
export class KysoSettingsController extends GenericController<KysoSetting> {
  constructor(private readonly kysoSettingsService: KysoSettingsService) {
    super();
  }

  @Get('/')
  @ApiOperation({
    summary: `Get's all the settings of this instance of Kyso`,
    description: `Get's all the settings of this instance of Kyso`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `List of all settings`,
    type: KysoSetting,
    isArray: true,
  })
  @UseGuards(PermissionsGuard)
  @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
  public async getAllSettings(): Promise<NormalizedResponseDTO<KysoSetting[]>> {
    const settings: KysoSetting[] = await this.kysoSettingsService.getAll();
    return new NormalizedResponseDTO(settings);
  }

  @Get('/public')
  @ApiOperation({
    summary: `Get all the public settings`,
    description: `Get all the public settings`,
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `List of public settings`,
    type: KysoSetting,
    isArray: true,
  })
  @Public()
  public async getOnlyPublicSettings(): Promise<NormalizedResponseDTO<KysoSetting[]>> {
    const allSettings: KysoSetting[] = await this.kysoSettingsService.getAll();
    // Filter all settings to only client_id
    const filteredSettings: KysoSetting[] = allSettings.filter((x: KysoSetting) => PUBLIC_KYSO_SETTINGS.includes(x.key as KysoSettingsEnum));
    return new NormalizedResponseDTO(filteredSettings);
  }

  @Get('/:key')
  @ApiOperation({
    summary: `Get setting by key`,
    description: `Get setting by key`,
  })
  @ApiParam({
    name: 'key',
    required: true,
    description: 'Key of the setting to get',
    schema: { type: 'string' },
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Setting data`,
    type: KysoSetting,
    isArray: false,
  })
  @Public()
  public async getSetting(@CurrentToken() token: Token, @Param('key') key: string): Promise<NormalizedResponseDTO<string>> {
    if (!token) {
      if (!PUBLIC_KYSO_SETTINGS.includes(key as KysoSettingsEnum)) {
        throw new ForbiddenException('You are not authorized to access this resource');
      }
    }
    const value: string = await this.kysoSettingsService.getValue(KysoSettingsEnum[key]);
    if (!value) {
      throw new NotFoundException('Setting not found');
    }
    return new NormalizedResponseDTO(value);
  }

  @Patch('/:key')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Updates provided key by provided value`,
    description: `Updates provided key by provided value`,
  })
  @ApiParam({
    name: 'key',
    required: true,
    description: 'Key of the setting to update',
    schema: { type: 'string' },
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Updated setting`,
    type: KysoSetting,
    isArray: false,
  })
  @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
  public async updateSetting(@Param('key') key: string, @Body() data: string): Promise<NormalizedResponseDTO<KysoSetting>> {
    const updated: KysoSetting = await this.kysoSettingsService.updateValue(KysoSettingsEnum[key], (data as any).value);
    return new NormalizedResponseDTO(updated);
  }
}
