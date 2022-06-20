import { GlobalPermissionsEnum, KysoSetting, KysoSettingsEnum, NormalizedResponseDTO } from '@kyso-io/kyso-model'
import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Public } from '../../decorators/is-public'
import { GenericController } from '../../generic/controller.generic'
import { Permission } from '../auth/annotations/permission.decorator'
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { SolvedCaptchaGuard } from '../auth/guards/solved-captcha.guard'
import { KysoSettingsService } from './kyso-settings.service'

@ApiTags('kyso-settings')
@ApiExtraModels(KysoSetting)
@ApiBearerAuth()
@Controller('kyso-settings')
export class KysoSettingsController extends GenericController<KysoSetting> {
    constructor(private readonly kysoSettingsService: KysoSettingsService) {
        super()
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
        const settings: KysoSetting[] = await this.kysoSettingsService.getAll()
        return new NormalizedResponseDTO(settings)
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
    public async getOnlyPublicSettings(): Promise<NormalizedResponseDTO<KysoSetting[]>> {
        const allSettings: KysoSetting[] = await this.kysoSettingsService.getAll()

        // Filter all settings to only client_id
        const filteredSettings = allSettings.filter((x: KysoSetting) => {
            switch (x.key) {
                case KysoSettingsEnum.AUTH_BITBUCKET_CLIENT_ID:
                case KysoSettingsEnum.AUTH_GITHUB_CLIENT_ID:
                case KysoSettingsEnum.AUTH_GITLAB_CLIENT_ID:
                case KysoSettingsEnum.AUTH_GOOGLE_CLIENT_ID:
                case KysoSettingsEnum.AUTH_GITLAB_REDIRECT_URI:
                case KysoSettingsEnum.RECAPTCHA2_SITE_KEY:
                case KysoSettingsEnum.KYSO_FILES_CLOUDFRONT_URL:
                case KysoSettingsEnum.RECAPTCHA2_ENABLED:
                case KysoSettingsEnum.BASE_URL:
                case KysoSettingsEnum.BITBUCKET_API:
                case KysoSettingsEnum.STATIC_CONTENT_PREFIX:
                case KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_BITBUCKET:
                case KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_GITLAB:
                case KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_GITHUB:
                case KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_GOOGLE:
                case KysoSettingsEnum.AUTH_ENABLE_GLOBALLY_KYSO:
                case KysoSettingsEnum.UNAUTHORIZED_REDIRECT_URL:
                case KysoSettingsEnum.CUSTOMIZE_LOGIN_CENTRAL_LOGO_URL:
                case KysoSettingsEnum.CUSTOMIZE_LOGIN_CENTRAL_REDIRECT_URL:
                case KysoSettingsEnum.CUSTOMIZE_LOGIN_LEFT_LOGO_URL:
                case KysoSettingsEnum.CUSTOMIZE_LOGIN_LEFT_REDIRECT_URL:
                case KysoSettingsEnum.CUSTOMIZE_LOGIN_RIGHT_LOGO_URL:
                case KysoSettingsEnum.CUSTOMIZE_LOGIN_RIGHT_REDIRECT_URL:
                case KysoSettingsEnum.CUSTOMIZE_LOGIN_CSS_STYLES:
                case KysoSettingsEnum.CUSTOMIZE_LOGIN_LINK_CSS_STYLES:
                case KysoSettingsEnum.CUSTOMIZE_LOGIN_HEADER_CSS_STYLES:
                case KysoSettingsEnum.CUSTOMIZE_LOGIN_SHOWDIV_CSS_STYLES:
                case KysoSettingsEnum.CUSTOMIZE_LOGIN_HIDDENDIV_CSS_STYLES:
                case KysoSettingsEnum.CUSTOMIZE_LOGIN_BUTTON_HOVER_CSS_STYLES:
                    return true
                default:
                    return false
            }
        })
        return new NormalizedResponseDTO(filteredSettings)
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
    // @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
    @Public()
    public async getSetting(@Param('key') key: string): Promise<NormalizedResponseDTO<string>> {
        const value: string = await this.kysoSettingsService.getValue(KysoSettingsEnum[key])
        return new NormalizedResponseDTO(value)
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
        const updated: KysoSetting = await this.kysoSettingsService.updateValue(KysoSettingsEnum[key], (data as any).value)
        return new NormalizedResponseDTO(updated)
    }
}
