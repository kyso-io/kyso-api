import { DynamicModule } from '@nestjs/common'
import { DiscussionsController } from './discussions.controller'
import { createProvider, DiscussionsService } from './discussions.service'
import { DiscussionsMongoProvider } from './providers/discussions-mongo.provider'

export class DiscussionsModule {
    static forRoot(): DynamicModule {
        const dynamicProvider = createProvider()
        return {
            module: DiscussionsModule,
            providers: [DiscussionsService, DiscussionsMongoProvider, dynamicProvider],
            controllers: [DiscussionsController],
            exports: [dynamicProvider],
        }
    }
}
