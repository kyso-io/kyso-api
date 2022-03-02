import { DynamicModule } from '@nestjs/common'
import { KysoSettingsController } from './kyso-settings.controller'
import { createProvider, KysoSettingsService } from './kyso-settings.service'
import { KysoSettingsMongoProvider } from './providers/kyso-settings-mongo.provider'

export class KysoSettingsModule {
    static forRoot(): DynamicModule {
        const dynamicProvider = createProvider()
        return {
            module: KysoSettingsModule,
            providers: [dynamicProvider, KysoSettingsMongoProvider, KysoSettingsService],
            controllers: [KysoSettingsController],
            exports: [dynamicProvider],
        }
    }
}
