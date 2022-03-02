import { GlobalPermissionsEnum, Invitation, KysoSetting, NormalizedResponseDTO, Token } from '@kyso-io/kyso-model'
import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { GenericController } from '../../generic/controller.generic'
import { Permission } from '../auth/annotations/permission.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { KysoSettingsEnum } from './enums/kyso-settings.enum'
import { KysoSettingsService } from './kyso-settings.service'

@ApiTags('kyso-settings')
@ApiExtraModels(KysoSetting)
@UseGuards(PermissionsGuard)
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
        isArray: true
    })
    @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
    public async getAllSettings(): Promise<NormalizedResponseDTO<KysoSetting[]>> {
        const settings: KysoSetting[] = await this.kysoSettingsService.getAll()
        return new NormalizedResponseDTO(settings)
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
        isArray: false
    })
    @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
    public async getSetting(@Param('key') key: string): Promise<NormalizedResponseDTO<boolean>> {
        const value: string = await this.kysoSettingsService.getValue(KysoSettingsEnum[key])
        return new NormalizedResponseDTO(value)
    }
}
