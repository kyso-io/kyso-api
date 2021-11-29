import { Injectable } from '@nestjs/common'
import { BitbucketReposProvider } from 'src/modules/bitbucket-repos/providers/bitbucket-repo.provider'

@Injectable()
export class BitbucketReposService {
    constructor(private readonly provider: BitbucketReposProvider) {}

    // TODO
}
