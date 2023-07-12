import { DynamicModule } from '@nestjs/common';
import { BitbucketReposService, createProvider } from './bitbucket-repos.service';
import { BitbucketReposProvider } from './providers/bitbucket-repo.provider';

export class BitbucketReposModule {
  static forRoot(): DynamicModule {
    const dynamicProvider = createProvider();

    return {
      module: BitbucketReposModule,
      providers: [BitbucketReposService, BitbucketReposProvider, dynamicProvider],
      // controllers: [BitbucketReposController],
      exports: [dynamicProvider],
    };
  }
}
