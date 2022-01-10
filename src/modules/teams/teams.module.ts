import { Module } from '@nestjs/common'
import { TeamMemberMongoProvider } from './providers/mongo-team-member.provider'
import { TeamsMongoProvider } from './providers/mongo-teams.provider'
import { TeamsController } from './teams.controller'
import { TeamsService } from './teams.service'

@Module({
    providers: [TeamsService, TeamsMongoProvider, TeamMemberMongoProvider],
    controllers: [TeamsController],
    exports: [TeamsService],
})
export class TeamsModule {}
