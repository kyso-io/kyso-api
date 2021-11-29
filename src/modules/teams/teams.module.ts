import { Module } from '@nestjs/common'
import { TeamsController } from './teams.controller'
import { TeamsService } from './teams.service'
import { TeamsMongoProvider } from './providers/mongo-teams.provider'

@Module({
    providers: [TeamsService, TeamsMongoProvider],
    controllers: [TeamsController],
    exports: [TeamsService],
})
export class TeamsModule {}
