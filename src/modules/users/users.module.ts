import { KysoSetting, KysoSettingsEnum } from '@kyso-io/kyso-model'
import { DynamicModule, Global } from '@nestjs/common'
import { ClientsModule, Transport } from '@nestjs/microservices'
import { db } from '../../main'
import { KysoUserAccessTokensMongoProvider } from './providers/mongo-kyso-user-access-token.provider'
import { UsersMongoProvider } from './providers/mongo-users.provider'
import { UserChangePasswordMongoProvider } from './providers/user-change-password-mongo.provider'
import { UserVerificationMongoProvider } from './providers/user-verification-mongo.provider'
import { UserController } from './user.controller'
import { UsersController } from './users.controller'
import { createProvider, UsersService } from './users.service'

@Global()
export class UsersModule {
    static forRoot(): DynamicModule {
        const dynamicProvider = createProvider()

        return {
            module: UsersModule,
            providers: [
                dynamicProvider,
                KysoUserAccessTokensMongoProvider,
                UsersMongoProvider,
                UsersService,
                UserChangePasswordMongoProvider,
                UserVerificationMongoProvider,
            ],
            controllers: [UserController, UsersController],
            exports: [dynamicProvider],
            imports: [
                ClientsModule.registerAsync([
                    {
                        name: 'NATS_SERVICE',
                        useFactory: async () => {
                            const kysoSettingCollection = db.collection('KysoSettings')
                            const server: KysoSetting[] = await kysoSettingCollection.find({ key: KysoSettingsEnum.KYSO_NATS_URL }).toArray()
                            return {
                                name: 'NATS_SERVICE',
                                transport: Transport.NATS,
                                options: {
                                    servers: [server[0].value],
                                },
                            }
                        },
                    },
                ]),
            ],
        }
    }
}
