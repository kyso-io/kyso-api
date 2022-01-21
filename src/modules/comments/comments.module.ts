import { DynamicModule } from '@nestjs/common'
import { CommentsController } from './comments.controller'
import { CommentsService, createProvider } from './comments.service'
import { CommentsMongoProvider } from './providers/mongo-comments.provider'

/*
@Module({
    providers: [
        {
            provide: CommentsService.getInjectionToken(), 
            useValue: CommentsService
        }, 
        CommentsMongoProvider],
    controllers: [CommentsController],
    // exports: [CommentsService],
})*/
export class CommentsModule {
    static forRoot(): DynamicModule {
        const dynamicProvider = createProvider()

        return {
            module: CommentsModule,
            providers: [CommentsMongoProvider, CommentsService, dynamicProvider],
            exports: [dynamicProvider],
            controllers: [CommentsController],
        }
    }
}
