import { Injectable, Provider } from '@nestjs/common'
import { AutowiredService } from '../../generic/autowired.generic'
import { BitbucketReposProvider } from './providers/bitbucket-repo.provider'

function factory(service: BitbucketReposService) {
    return service
}

export function createProvider(): Provider<BitbucketReposService> {
    return {
        provide: `${BitbucketReposService.name}`,
        useFactory: (service) => factory(service),
        inject: [BitbucketReposService],
    }
}

@Injectable()
export class BitbucketReposService extends AutowiredService {
    constructor(private readonly provider: BitbucketReposProvider) {
        super()
    }
}
