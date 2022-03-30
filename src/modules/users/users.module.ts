import { DynamicModule, Global } from '@nestjs/common'
import { KysoUserAccessTokensMongoProvider } from './providers/mongo-kyso-user-access-token.provider'
import { UsersMongoProvider } from './providers/mongo-users.provider'
import { UserVerificationMongoProvider } from './providers/user-verification-mongo.provider'
import { UserController } from './user.controller'
import { UsersController } from './users.controller'
import { createProvider, UsersService } from './users.service'

@Global()
/*@Module({
    providers: [UsersService, UsersMongoProvider],
    controllers: [UserController, UsersController],
    exports: [UsersService],
})*/
export class UsersModule {
    static forRoot(): DynamicModule {
        const dynamicProvider = createProvider()

        return {
            module: UsersModule,
            providers: [UsersService, UsersMongoProvider, KysoUserAccessTokensMongoProvider, dynamicProvider, UserVerificationMongoProvider],
            controllers: [UserController, UsersController],
            exports: [dynamicProvider],
        }
    }
}
