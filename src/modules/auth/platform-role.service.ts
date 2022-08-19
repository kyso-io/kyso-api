import { KysoRole } from '@kyso-io/kyso-model'
import { Injectable, Provider } from '@nestjs/common'
import { AutowiredService } from '../../generic/autowired.generic'
import { PlatformRoleMongoProvider } from './providers/mongo-platform-role.provider'

function factory(service: PlatformRoleService) {
    return service
}

export function createPlatformRoleProvider(): Provider<PlatformRoleService> {
    return {
        provide: `${PlatformRoleService.name}`,
        useFactory: (service) => factory(service),
        inject: [PlatformRoleService],
    }
}

@Injectable()
export class PlatformRoleService extends AutowiredService {
    constructor(private readonly platformRoleMongoProvider: PlatformRoleMongoProvider) {
        super()
    }
    async getPlatformRoles(): Promise<KysoRole[]> {
        return this.platformRoleMongoProvider.read({})
    }
}
