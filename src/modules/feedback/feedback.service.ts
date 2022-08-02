import { FeedbackDto, KysoEvent, KysoFeedbackCreateEvent, KysoSettingsEnum, Token } from '@kyso-io/kyso-model'
import { Inject, Injectable } from '@nestjs/common'
import { ClientProxy } from '@nestjs/microservices'
import { Autowired } from '../../decorators/autowired'
import { NATSHelper } from '../../helpers/natsHelper'
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
        NATSHelper.safelyEmit<KysoFeedbackCreateEvent>(this.client, KysoEvent.FEEDBACK_CREATE, {
            user: await this.usersService.getUserById(token.id),
            feedbackDto,
            serviceDeskEmail: await this.kysoSettingsService.getValue(KysoSettingsEnum.SERVICE_DESK_EMAIL),
        })

        return true
    }
}
