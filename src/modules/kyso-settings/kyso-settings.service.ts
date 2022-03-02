import { KysoSetting } from '@kyso-io/kyso-model'
import { Injectable, Provider } from '@nestjs/common'
import { AutowiredService } from '../../generic/autowired.generic'
import { KysoSettingsEnum } from './enums/kyso-settings.enum'
import { KysoSettingsMongoProvider } from './providers/kyso-settings-mongo.provider'

function factory(service: KysoSettingsService) {
    return service
}

export function createProvider(): Provider<KysoSettingsService> {
    return {
        provide: `${KysoSettingsService.name}`,
        useFactory: (service) => factory(service),
        inject: [KysoSettingsService],
    }
}

@Injectable()
export class KysoSettingsService extends AutowiredService {
    constructor(private readonly provider: KysoSettingsMongoProvider) {
        super()
    }

    public async getAll(): Promise<KysoSetting[]> {
        return this.provider.read({})
    }

    public async getValue(key: KysoSettingsEnum) {
        const result: KysoSetting[] = await this.provider.read({filter: {key: key}})
        
        if(result.length === 1) {
            return result[0].value
        } else {
            return null
        }
    }

    public async updateValue(key: KysoSettingsEnum, value: string) {
        const dataFields: any = {
            value: value
        }
        
        const updated: KysoSetting = await this.provider.update({ key: key }, { $set: dataFields })

        return updated;
    }
}
