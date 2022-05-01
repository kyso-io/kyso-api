import { KysoSettingsEnum } from '@kyso-io/kyso-model'
import { Injectable, Logger, Provider } from '@nestjs/common'
import * as Client from 'ssh2-sftp-client'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service'

function factory(service: SftpService) {
    return service
}

export function createSftpProvider(): Provider<SftpService> {
    return {
        provide: `${SftpService.name}`,
        useFactory: (service) => factory(service),
        inject: [SftpService],
    }
}

@Injectable()
export class SftpService extends AutowiredService {
    @Autowired({ typeName: 'KysoSettingsService' })
    private kysoSettingsService: KysoSettingsService

    constructor() {
        super()
    }

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
