import { KysoSetting, KysoSettingsEnum } from '@kyso-io/kyso-model'
import { DynamicModule } from '@nestjs/common'
import { ClientsModule, Transport } from '@nestjs/microservices'
import { db } from '../../main'
import { OrganizationsController } from './organizations.controller'
import { createProvider, OrganizationsService } from './organizations.service'
import { OrganizationMemberMongoProvider } from './providers/mongo-organization-member.provider'
import { OrganizationsMongoProvider } from './providers/mongo-organizations.provider'

/*
@Module({
    providers: [OrganizationsService, OrganizationsMongoProvider, OrganizationMemberMongoProvider],
    controllers: [OrganizationsController],
    exports: [OrganizationsService],
})*/
export class OrganizationsModule {
    static forRoot(): DynamicModule {
        const dynamicProvider = createProvider()

        return {
            module: OrganizationsModule,
            providers: [OrganizationsService, OrganizationsMongoProvider, OrganizationMemberMongoProvider, dynamicProvider],
            controllers: [OrganizationsController],
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
                                    servers: server[0] ? [server[0].value] : [],
                                },
                            }
                        },
                    },
                ]),
            ],
        }
    }
}
