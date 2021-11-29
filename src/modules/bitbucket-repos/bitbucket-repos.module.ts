import { Module } from '@nestjs/common';
import { BitbucketReposController } from './bitbucket-repos.controller';
import { BitbucketReposService } from './bitbucket-repos.service';
import { BitbucketReposProvider } from './providers/bitbucket-repo.provider';

@Module({
  providers: [BitbucketReposService, BitbucketReposProvider],
  controllers: [BitbucketReposController],
  exports: [BitbucketReposService],
})
export class BitbucketReposModule {}
