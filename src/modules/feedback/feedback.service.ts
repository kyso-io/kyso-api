import { FeedbackDto, KysoEvent, KysoFeedbackCreateEvent, KysoSettingsEnum, Token } from '@kyso-io/kyso-model'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ClientProxy } from '@nestjs/microservices'
import { Autowired } from '../../decorators/autowired'
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service'
import { UsersService } from '../users/users.service'

@Injectable()
export class FeedbackService {
    @Autowired({ typeName: 'KysoSettingsService' })
    private kysoSettingsService: KysoSettingsService

    @Autowired({ typeName: 'UsersService' })
    private usersService: UsersService

    constructor(@Inject('NATS_SERVICE') private client: ClientProxy) {}

    public async sendMessageToServiceDesk(token: Token, feedbackDto: FeedbackDto): Promise<boolean> {
        try {
            this.client.emit<KysoFeedbackCreateEvent>(KysoEvent.FEEDBACK_CREATE, {
                user: await this.usersService.getUserById(token.id),
                feedbackDto,
                serviceDeskEmail: await this.kysoSettingsService.getValue(KysoSettingsEnum.SERVICE_DESK_EMAIL),
            })
        } catch(ex) {
            Logger.warn(`Event ${KysoEvent.FEEDBACK_CREATE} not sent to NATS`);
        }
        
        return true
    }
}
