import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersMongoProvider } from './providers/mongo-users.provider';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [TeamsModule],
  providers: [
    UsersService,
    UsersMongoProvider
  ],
  controllers: [ UsersController ],
  exports: [ UsersService ]
})
export class UsersModule {

}
