import { DynamicModule } from '@nestjs/common'
import { ActivityFeedController } from './activity-feed.controller'
import { ActivityFeedService, createProvider } from './activity-feed.service'

export class ActivityFeedModule {
    static async forRoot(): Promise<DynamicModule> {
        const activityFeedServiceDynamicProvider = createProvider()
        return {
            controllers: [ActivityFeedController],
            exports: [activityFeedServiceDynamicProvider],
            module: ActivityFeedModule,
            providers: [ActivityFeedService, activityFeedServiceDynamicProvider],
        }
    }
}
