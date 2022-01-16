import { DynamicModule, Module } from '@nestjs/common'
import { TeamMemberMongoProvider } from './providers/mongo-team-member.provider'
import { TeamsMongoProvider } from './providers/mongo-teams.provider'
import { TeamsController } from './teams.controller'
import { createProvider, TeamsService } from './teams.service'

/*@Module({
    providers: [TeamsService, TeamsMongoProvider, TeamMemberMongoProvider],
    controllers: [TeamsController],
    exports: [TeamsService],
})*/
export class TeamsModule {
    static forRoot(): DynamicModule {
        const dynamicProvider = createProvider();
   
        return {
            module: TeamsModule,
            providers: [TeamsService, TeamsMongoProvider, TeamMemberMongoProvider, dynamicProvider],
            controllers: [TeamsController],
            exports: [dynamicProvider],
        };
    }
}
