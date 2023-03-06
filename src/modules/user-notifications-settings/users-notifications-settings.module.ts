import { DynamicModule } from '@nestjs/common';
import { UserNotificationsSettingsProvider } from './providers/user-notifications-settings.provider';
import { UsersNotificationsSettingsController } from './users-notifications-settings.controller';
import { createProvider, UsersNotificationsServiceService } from './users-notifications-settings.service';

export class UsersNotificationsSettingsModule {
  static forRoot(): DynamicModule {
    const dynamicProvider = createProvider();
    return {
      module: UsersNotificationsSettingsModule,
      providers: [UserNotificationsSettingsProvider, UsersNotificationsServiceService, dynamicProvider],
      controllers: [UsersNotificationsSettingsController],
      exports: [dynamicProvider],
    };
  }
}
