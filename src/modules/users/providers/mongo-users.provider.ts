import { GlobalPermissionsEnum, LoginProviderEnum, User, UserNotificationsSettings } from '@kyso-io/kyso-model';
import { OnboardingProgress } from '@kyso-io/kyso-model/dist/models/onboarding-progress.model';
import { Injectable, Logger } from '@nestjs/common';
import * as mongo from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../main';
import { MongoProvider } from '../../../providers/mongo.provider';
import { AuthService } from '../../auth/auth.service';
import { CommentsController } from '../../comments/comments.controller';

const DEFAULT_GLOBAL_ADMIN_USER = new User(
  'default-admin@kyso.io',
  'default-admin@kyso.io',
  'default-admin@kyso.io',
  'default-admin',
  LoginProviderEnum.KYSO,
  '',
  '',
  '',
  'free',
  'https://bit.ly/32hyGaj',
  null,
  false,
  [GlobalPermissionsEnum.GLOBAL_ADMIN],
  '',
  '',
  false, // show_onboarding
  new OnboardingProgress(true, true, true, true, true, true),
  new mongo.ObjectId('61a8ae8f9c2bc3c5a2144000').toString(),
);
@Injectable()
export class UsersMongoProvider extends MongoProvider<User> {
  provider: any;
  version = 9;

  constructor() {
    super('User', db, [
      {
        keys: {
          email: 'text',
          username: 'text',
          name: 'text',
          display_name: 'text',
        },
      },
    ]);
  }

  async populateMinimalData() {
    Logger.log(`Populating minimal data for ${this.baseCollection}`);

    Logger.log(`Creating default global admin user`);
    const randomPassword = uuidv4();
    Logger.log(`
                ad8888888888ba
                dP'         \`"8b,
                8  ,aaa,       "Y888a     ,aaaa,     ,aaa,  ,aa,
                8  8' \`8           "88baadP""""YbaaadP"""YbdP""Yb
                8  8   8              """        """      ""    8b
                8  8, ,8         ,aaaaaaaaaaaaaaaaaaaaaaaaddddd88P
                8  \`"""'       ,d8""
                Yb,         ,ad8"       PASSWORD FOR default-admin@kyso.io USER IS: ${randomPassword}
                "Y8888888888P"
        `);

    const copycat: User = Object.assign({}, DEFAULT_GLOBAL_ADMIN_USER);
    copycat.hashed_password = AuthService.hashPassword(randomPassword);

    await this.create(copycat);
  }

  /**
   * Refactored properties:
   *     - nickname to display_name
   *
   * This migration do:
   *     - Iterates through every document in Users collection
   *     - For each of them:
   *         - Read nickname and name properties
   *         - Adds a new display_name property with nickname value
   *
   * This migration DOES NOT DELETE name nor nickname, to be backwards compatible, but these properties are deprecated and will be deleted in next migrations
   *
   */
  async migrate_from_1_to_2() {
    const cursor = await this.getCollection().find({});
    const allUsers: any[] = await cursor.toArray();

    for (const user of allUsers) {
      const data: any = {
        display_name: user.nickname,
      };

      await this.update(
        { _id: this.toObjectId(user.id) },
        {
          $set: data,
        },
      );
    }

    // This is made automatically, so don't need to add it explicitly
    // await this.saveModelVersion(2)
  }

  async migrate_from_2_to_3() {
    const cursor = await this.getCollection().find({});
    const allUsers: any[] = await cursor.toArray();
    for (const user of allUsers) {
      const data: any = {
        show_captcha: true,
      };
      await this.update(
        { _id: this.toObjectId(user.id) },
        {
          $set: data,
        },
      );
    }
  }

  async migrate_from_3_to_4() {
    const cursor = await this.getCollection().find({});
    const allUsers: any[] = await cursor.toArray();
    for (const user of allUsers) {
      const data: any = {
        background_image_url: null,
      };
      await this.update(
        { _id: this.toObjectId(user.id) },
        {
          $set: data,
        },
      );
    }
  }

  /**
   * Added last_login property. In migration, set current date (in which migration was executed)
   */
  async migrate_from_4_to_5() {
    await this.updateMany(
      {},
      {
        $set: {
          last_login: new Date(),
        },
      },
    );
  }

  /**
   * Added a new property to user object "show_onboarding" if set a true, the onboarding process will be
   * shown, or hidden if false. In the migration, mark every user as true
   */
  async migrate_from_5_to_6() {
    await this.updateMany(
      {},
      {
        $set: {
          show_onboarding: true,
        },
      },
    );
  }

  /**
   * Added a new property to user object "onboarding_progress" to track progress of new users
   * For existing users, we will update them with the first step completed and the rest pending
   * just to show to them the onboarding steps
   */
  async migrate_from_6_to_7() {
    await this.updateMany(
      {},
      {
        $set: {
          onboarding_progress: {
            step_1: false,
            step_2: false,
            step_3: false,
            step_4: false,
            step_5: false,
          },
        },
      },
    );
  }

  /**
   * Added a new property "finish_and_remove" to user object "onboarding_progress" to track progress of new users
   * The notification bell will only disappear when finish_and_remove it's true
   */
  async migrate_from_7_to_8() {
    await this.updateMany(
      {},
      {
        $set: {
          onboarding_progress: OnboardingProgress.createEmpty(),
        },
      },
    );
  }

  /**
   * Add, for each user, an object to configure its notifications
   */
  async migrate_from_8_to_9(): Promise<void> {
    const users: User[] = await this.read({});
    for (const user of users) {
      const uns: UserNotificationsSettings = new UserNotificationsSettings(user.id);
      uns.global_settings.new_member_organization = true;
      uns.global_settings.change_or_removal_member_in_organization = true;
      uns.global_settings.updated_role_in_organization = true;
      uns.global_settings.deleted_organization = true;
      uns.global_settings.new_channel = true;
      uns.global_settings.new_member_channel = true;
      uns.global_settings.change_or_removal_member_in_channel = true;
      uns.global_settings.updated_role_in_channel = true;
      uns.global_settings.channel_deleted = true;
      uns.global_settings.new_report = true;
      uns.global_settings.new_report_vesion = true;
      uns.global_settings.deleted_report = true;
      uns.global_settings.new_comment_in_report = true;
      uns.global_settings.new_mention_in_report = true;
      uns.global_settings.report_comment_removed = true;
      uns.created_at = new Date();
      const createdUns: any = await this.getCollection('UserNotificationsSettings').insertOne(uns);
      await this.getCollection('UserNotificationsSettings').updateOne(
        { _id: createdUns.insertedId },
        {
          $set: {
            id: createdUns.insertedId.toString(),
            created_at: new Date(),
            updated_at: new Date(),
          },
        },
      );
    }
  }
}
