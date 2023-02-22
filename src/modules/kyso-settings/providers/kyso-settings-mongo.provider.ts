import { KysoSetting, KysoSettingsEnum } from '@kyso-io/kyso-model';
import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../../main';
import { MongoProvider } from '../../../providers/mongo.provider';
import { KysoSettingsService } from '../kyso-settings.service';

@Injectable()
export class KysoSettingsMongoProvider extends MongoProvider<KysoSetting> {
  version = 2;

  constructor() {
    super('KysoSettings', db);
    this.checkKysoSettings();
  }

  populateMinimalData() {
    for (const key in KysoSettingsEnum) {
      const defaultValue = KysoSettingsService.getKysoSettingDefaultValue(KysoSettingsEnum[key]);
      const description = KysoSettingsService.getKysoSettingDescription(KysoSettingsEnum[key]);

      Logger.log(`Populating setting ${key} with default value ${defaultValue}`);
      const toSave: KysoSetting = new KysoSetting(key, description, defaultValue);
      this.create(toSave);
    }
  }

  private async checkKysoSettings(): Promise<void> {
    const existsCollection = await this.existsMongoDBCollection(this.baseCollection);
    if (!existsCollection) {
      Logger.log('KysoSettings collection does not exist. Skipping check process...');
      return;
    }
    const allSettings = await this.read({});
    const settings = allSettings.map((setting) => setting.key);
    for (const key in KysoSettingsEnum) {
      if (!settings.includes(key)) {
        const defaultValue = KysoSettingsService.getKysoSettingDefaultValue(KysoSettingsEnum[key]);
        const description = KysoSettingsService.getKysoSettingDescription(KysoSettingsEnum[key]);
        Logger.log(`Populating setting ${key} with default value ${defaultValue}`, KysoSettingsMongoProvider.name);
        const toSave: KysoSetting = new KysoSetting(key, description, defaultValue);
        await this.create(toSave);
      }
    }
  }

  /**
   * ONBOARDING_MESSAGES was saved as string and should be saved as JSON.
   *
   * The migration consists on taking the current value of the ONBOARDING_MESSAGES, transform
   * it to a JSON object and update it in the database
   */
  async migrate_from_1_to_2() {
    const onboardingValue: any[] = await this.getCollection().find({ key: KysoSettingsEnum.ONBOARDING_MESSAGES }).toArray();

    if (onboardingValue) {
      let currentValue = '';
      if (onboardingValue.length > 0) {
        currentValue = onboardingValue[0].value as string;
      } else {
        Logger.warn('Onboarding value not found. Migration 1 to 2 from KysoSettings not applied');
        return;
      }

      // If we reach to this point, we have a value in currentValue
      try {
        // Transform to JSON
        const jsonValue = JSON.parse(currentValue);

        // Update it
        await this.update(
          { key: KysoSettingsEnum.ONBOARDING_MESSAGES },
          {
            $set: {
              value: jsonValue,
            },
          },
        );
      } catch (e) {
        Logger.warn('Error appliying Migration 1 to 2 from KysoSettings', e);
      }
    } else {
      Logger.warn('Onboarding value not found. Migration 1 to 2 from KysoSettings not applied :(');
    }
  }
}
