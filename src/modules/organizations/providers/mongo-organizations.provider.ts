import { AllowDownload, Organization, OrganizationAuthOptions, OrganizationNotifications, OrganizationOptions } from '@kyso-io/kyso-model';
import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import slug from '../../../helpers/slugify';
import { db } from '../../../main';
import { MongoProvider } from '../../../providers/mongo.provider';

@Injectable()
export class OrganizationsMongoProvider extends MongoProvider<Organization> {
  version = 11;

  constructor() {
    super('Organization', db);
  }

  populateMinimalData() {
    Logger.log(`${this.baseCollection} has no minimal data to populate`);
  }

  /**
   * Added a new field in organizations in version 2 which adds authentication options. So to upgrade from 1 to 2 we should:
   *     - Iterate through all the existing organizations
   *     - Update it adding the property options with the following structure
   *          options: {
   *              "auth" : {
   *                  "allow_login_with_kyso" : true,
   *                  "allow_login_with_google" : true,
   *                  "allow_login_with_github" : true,
   *                  "otherProviders" : [ ]
   *              }
   *          }
   */
  async migrate_from_1_to_2() {
    const allOrganizations: Organization[] = await this.read({});

    const orgOptions = new OrganizationOptions();
    const orgAuthOptions = new OrganizationAuthOptions();
    orgAuthOptions.allow_login_with_github = true;
    orgAuthOptions.allow_login_with_kyso = true;
    orgAuthOptions.allow_login_with_google = true;
    orgAuthOptions.otherProviders = [];
    orgOptions.auth = orgAuthOptions;

    for (const org of allOrganizations) {
      org.options = orgOptions;

      // If options does not exist, set the default value
      if (!org.options) {
        org.options = orgOptions;

        const data: any = {};
        data.options = orgOptions;

        Logger.log(`Migrating organization ${org.display_name} from version 1 to version 2`);

        // Add the default value
        await this.update(
          { _id: this.toObjectId(org.id) },
          {
            $set: data,
          },
        );
      }
    }

    // Update database to new version
    await this.saveModelVersion(2);
  }

  /**
   * Refactored properties:
   *     - nickname to display_name
   *     - name to sluglified_name
   *
   * This migration do:
   *     - Iterates through every document in Organization collection
   *     - For each of them:
   *         - Read nickname and name properties
   *         - Updates new display_name with nickname value
   *         - Updates new sluglified_name with name value, but sluglifing it
   *         - Updates name value as well but sluglifing it
   *
   * This migration DOES NOT DELETE name nor nickname, to be backwards compatible, but these properties are deprecated and will be deleted in next migrations
   */
  async migrate_from_2_to_3() {
    const cursor = await this.getCollection().find({});
    const allOrganizations: any[] = await cursor.toArray();

    for (const organization of allOrganizations) {
      const data: any = {
        sluglified_name: slug(organization.name),
        name: slug(organization.name),
        display_name: organization.nickname,
      };

      await this.update(
        { _id: this.toObjectId(organization.id) },
        {
          $set: data,
        },
      );
    }

    // This is made automatically, so don't need to add it explicitly
    // await this.saveModelVersion(3)
  }

  public async migrate_from_3_to_4() {
    const cursor = await this.getCollection().find({});
    const allOrganizations: any[] = await cursor.toArray();
    for (const organization of allOrganizations) {
      const data: any = {
        invitation_code: uuidv4(),
      };
      await this.update(
        { _id: this.toObjectId(organization.id) },
        {
          $set: data,
        },
      );
    }
  }

  public async migrate_from_4_to_5(): Promise<void> {
    const cursor = await this.getCollection().find({});
    const allOrganizations: any[] = await cursor.toArray();
    for (const organization of allOrganizations) {
      const orgNotifications: OrganizationNotifications = new OrganizationNotifications(false, [], null, null, null);
      let data: any = null;
      if (organization.options) {
        data = {
          options: {
            ...organization.options,
            notifications: orgNotifications,
          },
        };
      } else {
        const orgOptions = new OrganizationOptions();
        const orgAuthOptions = new OrganizationAuthOptions();
        orgAuthOptions.allow_login_with_github = true;
        orgAuthOptions.allow_login_with_kyso = true;
        orgAuthOptions.allow_login_with_google = true;
        orgAuthOptions.otherProviders = [];
        orgOptions.auth = orgAuthOptions;
        orgOptions.notifications = orgNotifications;
        data = {
          options: orgOptions,
        };
      }

      await this.update(
        { _id: this.toObjectId(organization.id) },
        {
          $set: data,
        },
      );
    }
  }

  public async migrate_from_5_to_6(): Promise<void> {
    const cursor = await this.getCollection().find({});
    const allOrganizations: any[] = await cursor.toArray();
    for (const organization of allOrganizations) {
      let data: any = null;
      if (organization.options?.auth) {
        data = {
          options: {
            ...organization.options,
            auth: {
              ...organization.options.auth,
              allow_login_with_bitbucket: true,
              allow_login_with_gitlab: true,
            },
          },
        };
      } else {
        const orgOptions = new OrganizationOptions();
        const orgAuthOptions = new OrganizationAuthOptions();
        orgAuthOptions.allow_login_with_github = true;
        orgAuthOptions.allow_login_with_kyso = true;
        orgAuthOptions.allow_login_with_google = true;
        orgAuthOptions.allow_login_with_bitbucket = true;
        orgAuthOptions.allow_login_with_gitlab = true;
        orgAuthOptions.otherProviders = [];
        orgOptions.auth = orgAuthOptions;
        const orgNotifications: OrganizationNotifications = new OrganizationNotifications(false, [], null, null, null);
        orgNotifications.centralized = false;
        orgNotifications.emails = [];
        orgOptions.notifications = orgNotifications;
        data = {
          options: orgOptions,
        };
      }

      await this.update(
        { _id: this.toObjectId(organization.id) },
        {
          $set: data,
        },
      );
    }
  }

  public async migrate_from_6_to_7(): Promise<void> {
    const cursor = await this.getCollection().find({});
    const allOrganizations: any[] = await cursor.toArray();
    for (const organization of allOrganizations) {
      if (!organization.options || Object.keys(organization.options).length === 0) {
        organization.options = new OrganizationOptions();
      }
      const notifications: OrganizationNotifications = organization.options.notifications;
      notifications.slackToken = null;
      notifications.slackChannel = null;
      await this.update(
        { _id: this.toObjectId(organization.id) },
        {
          $set: {
            options: organization.options,
          },
        },
      );
    }
  }

  public async migrate_from_7_to_8(): Promise<void> {
    const cursor = await this.getCollection().find({});
    const allOrganizations: any[] = await cursor.toArray();
    for (const organization of allOrganizations) {
      await this.update(
        { _id: this.toObjectId(organization.id) },
        {
          $set: {
            user_id: null,
          },
        },
      );
    }
  }

  public async migrate_from_8_to_9(): Promise<void> {
    await this.updateMany(
      {},
      {
        $set: {
          join_codes: null,
        },
      },
    );
  }

  public async migrate_from_9_to_10(): Promise<void> {
    await this.updateMany(
      {},
      {
        $set: {
          allow_download: AllowDownload.ALL,
        },
      },
    );
  }

  public async migrate_from_10_to_11(): Promise<void> {
    const cursor = await this.getCollection().find({});
    const allOrganizations: any[] = await cursor.toArray();
    for (const organization of allOrganizations) {
      const orgNotifications: OrganizationNotifications = new OrganizationNotifications(false, [], null, null, null);
      let data: any = null;
      if (organization.options) {
        data = {
          options: {
            ...organization.options,
            notifications: orgNotifications !== null ? { ...organization.options.notifications, teamsIncomingWebhookUrl: null } : orgNotifications,
          },
        };
      } else {
        const orgOptions: OrganizationOptions = new OrganizationOptions();
        const orgAuthOptions: OrganizationAuthOptions = new OrganizationAuthOptions();
        orgAuthOptions.allow_login_with_github = true;
        orgAuthOptions.allow_login_with_kyso = true;
        orgAuthOptions.allow_login_with_google = true;
        orgAuthOptions.otherProviders = [];
        orgOptions.auth = orgAuthOptions;
        orgOptions.notifications = orgNotifications;
        data = {
          options: orgOptions,
        };
      }
      await this.update(
        { _id: this.toObjectId(organization.id) },
        {
          $set: data,
        },
      );
    }
  }
}
