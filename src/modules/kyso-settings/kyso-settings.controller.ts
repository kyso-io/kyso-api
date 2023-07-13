import { GlobalPermissionsEnum, KysoSetting, KysoSettingsEnum, NormalizedResponseDTO, Token, UpdateKysoSettingDto } from '@kyso-io/kyso-model';
import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../decorators/is-public';
import { GenericController } from '../../generic/controller.generic';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { Permission } from '../auth/annotations/permission.decorator';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { KysoSettingsService } from './kyso-settings.service';

const PUBLIC_KYSO_SETTINGS: KysoSettingsEnum[] = [
  KysoSettingsEnum.AUTH_BITBUCKET_CLIENT_ID,
  KysoSettingsEnum.AUTH_GITHUB_CLIENT_ID,
  KysoSettingsEnum.AUTH_GITLAB_CLIENT_ID,
  KysoSettingsEnum.AUTH_GOOGLE_CLIENT_ID,
  KysoSettingsEnum.AUTH_GITLAB_REDIRECT_URI,
  KysoSettingsEnum.AUTH_PINGID_SAML_SSO_URL,
  KysoSettingsEnum.AUTH_OKTA_SAML_SSO_URL,
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
  KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_OKTA_SAML,
  KysoSettingsEnum.UNAUTHORIZED_REDIRECT_URL,
  KysoSettingsEnum.MAX_FILE_SIZE,
  KysoSettingsEnum.DEFAULT_REDIRECT_ORGANIZATION,
  KysoSettingsEnum.THEME,
  KysoSettingsEnum.ENABLE_INVITATION_LINKS_GLOBALLY,
  KysoSettingsEnum.GLOBAL_PRIVACY_SHOW_EMAIL,
  KysoSettingsEnum.ALLOW_PUBLIC_CHANNELS,
  KysoSettingsEnum.ONBOARDING_MESSAGES,
  KysoSettingsEnum.FOOTER_CONTENTS,
  KysoSettingsEnum.KYSO_COMMENT_STATES_VALUES,
];

@ApiTags('kyso-settings')
@ApiExtraModels(KysoSetting)
@Controller('kyso-settings')
export class KysoSettingsController extends GenericController<KysoSetting> {
  constructor(private readonly kysoSettingsService: KysoSettingsService) {
    super();
  }

  @Get('/')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @ApiOperation({
    summary: `Get's all the settings of this instance of Kyso`,
    description: `Get's all the settings of this instance of Kyso`,
  })
  @ApiResponse({
    status: 200,
    description: 'List of all settings',
    content: {
      json: {
        examples: {
          comment: {
            value: new NormalizedResponseDTO<KysoSetting[]>([KysoSetting.createEmpty()]),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException(),
          },
        },
      },
    },
  })
  @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
  public async getAllSettings(): Promise<NormalizedResponseDTO<KysoSetting[]>> {
    const settings: KysoSetting[] = await this.kysoSettingsService.getAll();
    return new NormalizedResponseDTO(settings);
  }

  @Get('/public')
  @Public()
  @ApiOperation({
    summary: `Get all the public settings`,
    description: `Get all the public settings`,
  })
  @ApiResponse({
    status: 200,
    description: 'List of public settings',
    content: {
      json: {
        examples: {
          comment: {
            value: new NormalizedResponseDTO<KysoSetting[]>([KysoSetting.createEmpty()]),
          },
        },
      },
    },
  })
  public async getOnlyPublicSettings(): Promise<NormalizedResponseDTO<KysoSetting[]>> {
    const allSettings: KysoSetting[] = await this.kysoSettingsService.getAll();
    const filteredSettings: KysoSetting[] = allSettings.filter((x: KysoSetting) => PUBLIC_KYSO_SETTINGS.includes(x.key as KysoSettingsEnum));
    return new NormalizedResponseDTO(filteredSettings);
  }

  @Get('/:key')
  @Public()
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
  @ApiResponse({
    status: 200,
    description: 'Value of settings',
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<string>(''),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException('You are not authorized to access this resource'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          notFound: {
            value: new NotFoundException('Setting not found'),
          },
        },
      },
    },
  })
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
  @ApiBearerAuth()
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
  @ApiResponse({
    status: 200,
    description: 'Updated settings',
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<KysoSetting>(KysoSetting.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException('You are not authorized to access this resource'),
          },
        },
      },
    },
  })
  @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
  public async updateSetting(@Param('key') key: string, @Body() updateKysoSettingDto: UpdateKysoSettingDto): Promise<NormalizedResponseDTO<KysoSetting>> {
    const updated: KysoSetting = await this.kysoSettingsService.updateValue(KysoSettingsEnum[key], updateKysoSettingDto);
    return new NormalizedResponseDTO(updated);
  }
}
