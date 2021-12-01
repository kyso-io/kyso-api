import { forwardRef, Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { CommentsController } from './comments.controller'
import { CommentsService } from './comments.service'
import { CommentsMongoProvider } from './providers/mongo-comments.provider'

@Module({
    imports: [forwardRef(() => AuthModule)],
    providers: [CommentsService, CommentsMongoProvider],
    controllers: [CommentsController],
    exports: [CommentsService],
})
export class CommentsModule {}
