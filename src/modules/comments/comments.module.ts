import { forwardRef, Module } from '@nestjs/common'
import { ReportsModule } from '../reports/reports.module'
import { TeamsModule } from '../teams/teams.module'
import { CommentsController } from './comments.controller'
import { CommentsService } from './comments.service'
import { CommentsMongoProvider } from './providers/mongo-comments.provider'

@Module({
    providers: [CommentsService, CommentsMongoProvider],
    controllers: [CommentsController],
    exports: [CommentsService],
    imports: [forwardRef(() => ReportsModule), TeamsModule],
})
export class CommentsModule {}
