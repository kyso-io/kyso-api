import { KysoSetting } from '@kyso-io/kyso-model'
import { Injectable, Logger } from '@nestjs/common'
import { db } from '../../../main'
import { MongoProvider } from '../../../providers/mongo.provider'
import { getKysoSettingDefaultValue, getKysoSettingDescription, KysoSettingsEnum } from '../enums/kyso-settings.enum'

@Injectable()
export class KysoSettingsMongoProvider extends MongoProvider<KysoSetting> {
    version = 1
    
    constructor() {
        super('KysoSettings', db)
    }

    populateMinimalData() {
        for(const key in KysoSettingsEnum) {
            const defaultValue = getKysoSettingDefaultValue(KysoSettingsEnum[key])
            const description = getKysoSettingDescription(KysoSettingsEnum[key])

            Logger.log(`Populating setting ${key} with default value ${defaultValue}`)
            const toSave: KysoSetting = new KysoSetting(key, description, defaultValue)
            this.create(toSave)
        }
    }
}
