import { Module } from '@nestjs/common'
import { OrganizationsModule } from '../organizations/organizations.module'
import { TeamMemberMongoProvider } from './providers/mongo-team-member.provider'
import { TeamsMongoProvider } from './providers/mongo-teams.provider'
import { TeamsController } from './teams.controller'
import { TeamsService } from './teams.service'

@Module({
    imports: [ OrganizationsModule ],
    providers: [TeamsService, TeamsMongoProvider, TeamMemberMongoProvider],
    controllers: [TeamsController],
    exports: [TeamsService],
})
export class TeamsModule {}
