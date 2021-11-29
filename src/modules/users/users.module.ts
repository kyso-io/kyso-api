import { Module } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { UsersMongoProvider } from './providers/mongo-users.provider'
import { TeamsModule } from '../teams/teams.module'
import { UserController } from './user.controller'

@Module({
    imports: [TeamsModule],
    providers: [UsersService, UsersMongoProvider],
    controllers: [UsersController, UserController],
    exports: [UsersService],
})
export class UsersModule {}
