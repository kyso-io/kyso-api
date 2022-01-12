import { DynamicModule, Module } from '@nestjs/common'
import { BitbucketReposController } from './bitbucket-repos.controller'
import { BitbucketReposService, createProvider } from './bitbucket-repos.service'
import { BitbucketReposProvider } from './providers/bitbucket-repo.provider'

/*
@Module({
    providers: [BitbucketReposService, BitbucketReposProvider],
    controllers: [BitbucketReposController],
    exports: [BitbucketReposService],
})*/
export class BitbucketReposModule {
    static forRoot(): DynamicModule {
        const dynamicProvider = createProvider();
   
        return {
            module: BitbucketReposModule,
            providers: [BitbucketReposService, BitbucketReposProvider, dynamicProvider],
            controllers: [BitbucketReposController],
            exports: [dynamicProvider]
        };
    }
}
