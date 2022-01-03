import { Injectable } from '@nestjs/common'
import { BitbucketReposProvider } from './providers/bitbucket-repo.provider';

@Injectable()
export class BitbucketReposService {
    constructor(private readonly provider: BitbucketReposProvider) {}
}
