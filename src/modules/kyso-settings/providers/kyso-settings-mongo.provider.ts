import { KysoSetting, KysoSettingsEnum } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'
import { KysoSettingsService } from '../kyso-settings.service'


@Injectable()
export class KysoSettingsMongoProvider extends MongoProvider<KysoSetting> {
    version = 1

    constructor() {
        super('KysoSettings', db)
        this.checkKysoSettings()
    }

    populateMinimalData() {
        for (const key in KysoSettingsEnum) {
            const defaultValue = KysoSettingsService.getKysoSettingDefaultValue(KysoSettingsEnum[key])
            const description = KysoSettingsService.getKysoSettingDescription(KysoSettingsEnum[key])

            Logger.log(`Populating setting ${key} with default value ${defaultValue}`)
            const toSave: KysoSetting = new KysoSetting(key, description, defaultValue)
            this.create(toSave)
        }
    }

    private async checkKysoSettings(): Promise<void> {
        const existsCollection = await this.existsMongoDBCollection(this.baseCollection)
        if (!existsCollection) {
            Logger.log('KysoSettings collection does not exist. Skipping check process...')
            return
        }
        const allSettings = await this.read({})
        const settings = allSettings.map((setting) => setting.key)
        for (const key in KysoSettingsEnum) {
            if (!settings.includes(key)) {
                const defaultValue = KysoSettingsService.getKysoSettingDefaultValue(KysoSettingsEnum[key])
                const description = KysoSettingsService.getKysoSettingDescription(KysoSettingsEnum[key])
                Logger.log(`Populating setting ${key} with default value ${defaultValue}`, KysoSettingsMongoProvider.name)
                const toSave: KysoSetting = new KysoSetting(key, description, defaultValue)
                await this.create(toSave)
            }
        }
    }
}
