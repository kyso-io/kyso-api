import { DynamicModule } from '@nestjs/common'
import { TagsAssignMongoProvider } from './providers/tags-assign-mongo.provider'
import { TagsMongoProvider } from './providers/tags-mongo.provider'
import { TagsController } from './tags.controller'
import { createProvider, TagsService } from './tags.service'

export class TagsModule {
    static forRoot(): DynamicModule {
        const dynamicProvider = createProvider()
        return {
            module: TagsModule,
            providers: [TagsAssignMongoProvider, TagsService, TagsMongoProvider, dynamicProvider],
            controllers: [TagsController],
            exports: [dynamicProvider],
        }
    }
}
