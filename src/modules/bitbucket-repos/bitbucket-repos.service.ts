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

    public async getRepository(accessToken: string, fullName: string): Promise<any> {
        return this.bitbucketReposProvider.getRepository(accessToken, fullName)
    }

    public async downloadRepository(accessToken: string, fullName: string, commit: string): Promise<Buffer> {
        return this.bitbucketReposProvider.downloadRepository(accessToken, fullName, commit)
    }

    public async getWebhooks(accessToken: string, fullName: string): Promise<any> {
        return this.bitbucketReposProvider.getWebhooks(accessToken, fullName)
    }

    public async createWebhook(accessToken: string, fullName: string): Promise<any> {
        let hookUrl = `${process.env.BASE_URL}/v1/hooks/bitbucket`
        if (process.env.NODE_ENV === 'development') {
            hookUrl = 'https://smee.io/kyso-bitbucket-hook-test'
        }
        return this.bitbucketReposProvider.createWebhook(accessToken, fullName, {
            description: 'Kyso webhook',
            url: hookUrl,
            active: true,
            events: ['repo:push'],
        })
    }

    public async deleteWebhook(accessToken: string, fullName: string, hookId: number): Promise<any> {
        return this.bitbucketReposProvider.deleteWebhook(accessToken, fullName, hookId)
    }

    public async getBranches(accessToken: string, fullName: string): Promise<any> {
        return this.bitbucketReposProvider.getBranches(accessToken, fullName)
    }

    public async getCommits(accessToken: string, fullName: string, branch: string): Promise<any> {
        return this.bitbucketReposProvider.getCommits(accessToken, fullName, branch)
    }

    public async getRootFilesAndFoldersByCommit(accessToken: string, fullName: string, commit: string, folder: string, pageCode: number): Promise<any> {
        return this.bitbucketReposProvider.getRootFilesAndFoldersByCommit(accessToken, fullName, commit, folder, pageCode)
    }

    public async getFileContent(accessToken: string, fullName: string, commit: string, filePath: string): Promise<any> {
        return this.bitbucketReposProvider.getFileContent(accessToken, fullName, commit, filePath)
    }

    public async getUser(accessToken: string): Promise<any> {
        return this.bitbucketReposProvider.getUser(accessToken)
    }

    public async login(code: string): Promise<any> {
        return this.bitbucketReposProvider.login(code)
    }

    public async refreshToken(refreshToken: string): Promise<any> {
        return this.bitbucketReposProvider.refreshToken(refreshToken)
    }
}
