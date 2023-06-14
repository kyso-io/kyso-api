import { KysoSetting, KysoSettingsEnum } from '@kyso-io/kyso-model';
import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../../main';
import { MongoProvider } from '../../../providers/mongo.provider';
import { KysoSettingsService } from '../kyso-settings.service';

@Injectable()
export class KysoSettingsMongoProvider extends MongoProvider<KysoSetting> {
  version = 5;

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

        const insertedDocument = await this.create(toSave);

        // Update the value because PATATA
        await this.updateOne({ _id: insertedDocument._id }, { $set: { value: defaultValue } });
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

  /**
   * FOOTER_CONTENTS was saved as string and should be saved as JSON.
   *
   * The migration consists on taking the current value of the FOOTER_CONTENTS, transform
   * it to a JSON object and update it in the database
   */
  async migrate_from_2_to_3() {
    const footerContents: any[] = await this.getCollection().find({ key: KysoSettingsEnum.FOOTER_CONTENTS }).toArray();

    if (footerContents) {
      let currentValueFooterContents = '';
      if (footerContents.length > 0) {
        currentValueFooterContents = footerContents[0].value as string;
      } else {
        Logger.warn('FooterContents value not found. Migration 2 to 3 from KysoSettings not applied');
        return;
      }

      // If we reach to this point, we have a value in currentValue
      try {
        // Transform to JSON
        const jsonValue = JSON.parse(currentValueFooterContents);

        // Update it
        await this.update(
          { key: KysoSettingsEnum.FOOTER_CONTENTS },
          {
            $set: {
              value: jsonValue,
            },
          },
        );
      } catch (e) {
        Logger.warn('Error appliying Migration 2 to 3 from KysoSettings', e);
      }
    } else {
      Logger.warn('Footer value not found. Migration 2 to 3 from KysoSettings not applied :(');
    }
  }

  /**
   * KYSO_COMMENT_STATES_VALUES was saved as string and should be saved as JSON.
   *
   * The migration consists on taking the current value of the KYSO_COMMENT_STATES_VALUES, transform
   * it to a JSON object and update it in the database
   */
  async migrate_from_3_to_4() {
    const commentStates: any[] = await this.getCollection().find({ key: KysoSettingsEnum.KYSO_COMMENT_STATES_VALUES }).toArray();

    if (commentStates) {
      let currentValue = '';
      if (commentStates.length > 0) {
        currentValue = commentStates[0].value as string;
      } else {
        Logger.warn('FooterContents value not found. Migration 2 to 3 from KysoSettings not applied');
        return;
      }

      // If we reach to this point, we have a value in currentValue
      try {
        // Transform to JSON
        const jsonValue = JSON.parse(currentValue);

        // Update it
        await this.update(
          { key: KysoSettingsEnum.KYSO_COMMENT_STATES_VALUES },
          {
            $set: {
              value: jsonValue,
            },
          },
        );
      } catch (e) {
        Logger.warn('Error appliying Migration 3 to 4 from KysoSettings', e);
      }
    } else {
      Logger.warn('KYSO_COMMENT_STATES_VALUES not found. Migration 3 to 4 from KysoSettings not applied :(');
    }
  }

  /**
   * Removing deprecated and unused settings:
   *  KYSO_FILES_CLOUDFRONT_URL
   *  AWS_REGION
   *  AWS_S3_BUCKET
   *  AWS_ACCESS_KEY_ID
   *  AWS_SECRET_ACCESS_KEY
   *
   * The migration consists on deleting these keys from the database
   */
  async migrate_from_4_to_5() {
    const toDelete: KysoSettingsEnum[] = [
      KysoSettingsEnum.KYSO_FILES_CLOUDFRONT_URL,
      KysoSettingsEnum.AWS_REGION,
      KysoSettingsEnum.AWS_S3_BUCKET,
      KysoSettingsEnum.AWS_ACCESS_KEY_ID,
      KysoSettingsEnum.AWS_SECRET_ACCESS_KEY,
    ];

    for (const ksetting of toDelete) {
      try {
        Logger.log(`Deleting deprecated setting ${ksetting}`);

        await this.deleteOne({ key: ksetting });
      } catch (e) {
        Logger.warn(`Error deleting deprecated setting ${ksetting}`, e);
      }
    }
  }
}
