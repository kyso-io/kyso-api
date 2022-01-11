import { Injectable, Provider } from '@nestjs/common'
import { BitbucketReposProvider } from './providers/bitbucket-repo.provider'

function factory(service: BitbucketReposService) {
    return service;
}
  
export function createProvider(): Provider<BitbucketReposService> {
    return {
        provide: `${BitbucketReposService.name}`,
        useFactory: service => factory(service),
        inject: [BitbucketReposService],
    };
}

@Injectable()
export class BitbucketReposService {
    constructor(private readonly provider: BitbucketReposProvider) {}
}
