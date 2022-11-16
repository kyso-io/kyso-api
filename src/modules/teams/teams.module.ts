import { DynamicModule } from '@nestjs/common';
import { registerNatsService } from '../../providers/nats-service-register';
import { TeamMemberMongoProvider } from './providers/mongo-team-member.provider';
import { TeamsMongoProvider } from './providers/mongo-teams.provider';
import { TeamsController } from './teams.controller';
import { createProvider, TeamsService } from './teams.service';

export class TeamsModule {
  static forRoot(): DynamicModule {
    const dynamicProvider = createProvider();

    return {
      module: TeamsModule,
      providers: [TeamsService, TeamsMongoProvider, TeamMemberMongoProvider, dynamicProvider],
      controllers: [TeamsController],
      exports: [dynamicProvider],
      imports: [registerNatsService()],
    };
  }
}
