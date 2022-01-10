import { Global, Module } from '@nestjs/common'
import { UsersMongoProvider } from './providers/mongo-users.provider'
import { UserController } from './user.controller'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'

@Global()
@Module({
    providers: [UsersService, UsersMongoProvider],
    controllers: [UserController, UsersController],
    exports: [UsersService],
})
export class UsersModule {}
