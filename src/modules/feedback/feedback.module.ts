import { KysoSetting, KysoSettingsEnum } from '@kyso-io/kyso-model'
import { Module } from '@nestjs/common'
import { ClientsModule, Transport } from '@nestjs/microservices'
import { db } from '../../main'
import { FeedbackController } from './feedback.controller'
import { FeedbackService } from './feedback.service'

@Module({
    controllers: [FeedbackController],
    providers: [FeedbackService],
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
})
export class FeedbackModule {}
