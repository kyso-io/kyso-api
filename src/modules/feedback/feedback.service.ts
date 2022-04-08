import { FeedbackDto, KysoSettingsEnum, Token } from '@kyso-io/kyso-model'
import { MailerService } from '@nestjs-modules/mailer'
import { Injectable, Logger } from '@nestjs/common'
import { Autowired } from '../../decorators/autowired'
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service'

@Injectable()
export class FeedbackService {
    @Autowired({ typeName: 'KysoSettingsService' })
    private kysoSettingsService: KysoSettingsService

    constructor(private readonly mailerService: MailerService) {}

    public async sendMessageToServiceDesk(token: Token, feedbackDto: FeedbackDto): Promise<boolean> {
        const serviceDeskEmail: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.SERVICE_DESK_EMAIL)
        this.mailerService
            .sendMail({
                from: `"${token.username}" <${token.email}>`,
                to: serviceDeskEmail,
                subject: feedbackDto.subject,
                html: feedbackDto.message,
            })
            .then((messageInfo) => {
                Logger.log(
                    `Feedback e-mail ${messageInfo.messageId} from user '${token.id} - ${token.username}' send to ${serviceDeskEmail}`,
                    FeedbackService.name,
                )
            })
            .catch((err) => {
                Logger.error(
                    `An error occurrend sending feedback e-mail from user '${token.id} - ${token.username}' to ${serviceDeskEmail}`,
                    err,
                    FeedbackService.name,
                )
            })
        return true
    }
}
