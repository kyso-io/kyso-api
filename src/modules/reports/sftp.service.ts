import { Injectable, Logger } from '@nestjs/common'
import * as Client from 'ssh2-sftp-client'
import { Autowired } from '../../decorators/autowired'
import { KysoSettingsEnum } from '../kyso-settings/enums/kyso-settings.enum'
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service'

@Injectable()
export class SftpService {
    @Autowired({ typeName: 'KysoSettingsService' })
    private kysoSettingsService: KysoSettingsService

    constructor() {}

    public async getClient(): Promise<Client> {
        try {
            const client: Client = new Client()
            await client.connect({
                host: await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_HOST),
                port: parseInt(await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_PORT), 10),
                username: await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_USERNAME),
                password: await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_PASSWORD),
            })
            return client
        } catch (e) {
            Logger.error(`Failed to connect to SFTP server`, e, KysoSettingsService.name)
            return null
        }
    }
}
