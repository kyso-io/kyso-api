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
    constructor(private readonly bitbucketReposProvider: BitbucketReposProvider) {
        super()
    }

    public async getRepository(username: string, password: string, fullName: string): Promise<any> {
        return this.bitbucketReposProvider.getRepository(username, password, fullName)
    }

    public async downloadRepository(username: string, password: string, fullName: string, commit: string): Promise<Buffer> {
        return this.bitbucketReposProvider.downloadRepository(username, password, fullName, commit)
    }

    public async getWebhooks(username: string, password: string, fullName: string): Promise<any> {
        return this.bitbucketReposProvider.getWebhooks(username, password, fullName)
    }

    public async createWebhook(username: string, password: string, fullName: string): Promise<any> {
        let hookUrl = `${process.env.BASE_URL}/v1/hooks/bitbucket`
        if (process.env.NODE_ENV === 'development') {
            hookUrl = 'https://smee.io/kyso-bitbucket-hook-test'
        }
        return this.bitbucketReposProvider.createWebhook(username, password, fullName, {
            description: 'Kyso webhook',
            url: hookUrl,
            active: true,
            events: ['repo:push'],
        })
    }

    public async deleteWebhook(username: string, password: string, fullName: string, hookId: number): Promise<any> {
        return this.bitbucketReposProvider.deleteWebhook(username, password, fullName, hookId)
    }

    public async getBranches(username: string, password: string, fullName: string): Promise<any> {
        return this.bitbucketReposProvider.getBranches(username, password, fullName)
    }

    public async getCommits(username: string, password: string, fullName: string, branch: string): Promise<any> {
        return this.bitbucketReposProvider.getCommits(username, password, fullName, branch)
    }

    public async getRootFilesAndFoldersByCommit(
        username: string,
        password: string,
        fullName: string,
        commit: string,
        folder: string,
        pageCode: number,
    ): Promise<any> {
        return this.bitbucketReposProvider.getRootFilesAndFoldersByCommit(username, password, fullName, commit, folder, pageCode)
    }

    public async getFileContent(username: string, password: string, fullName: string, commit: string, filePath: string): Promise<any> {
        return this.bitbucketReposProvider.getFileContent(username, password, fullName, commit, filePath)
    }
}
