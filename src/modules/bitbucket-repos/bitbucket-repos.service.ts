import { Injectable, Provider } from '@nestjs/common';
import { Autowired } from '../../decorators/autowired';
import { AutowiredService } from '../../generic/autowired.generic';
import { KysoSettingsEnum } from '@kyso-io/kyso-model';
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service';
import { BitbucketReposProvider } from './providers/bitbucket-repo.provider';
import { BitbucketEmail } from './classes/bitbucket-email';
import { BitbucketPaginatedResponse } from './classes/bitbucket-paginated-response';

function factory(service: BitbucketReposService) {
  return service;
}

export function createProvider(): Provider<BitbucketReposService> {
  return {
    provide: `${BitbucketReposService.name}`,
    useFactory: (service) => factory(service),
    inject: [BitbucketReposService],
  };
}

@Injectable()
export class BitbucketReposService extends AutowiredService {
  @Autowired({ typeName: 'KysoSettingsService' })
  private kysoSettingsService: KysoSettingsService;

  constructor(private readonly bitbucketReposProvider: BitbucketReposProvider) {
    super();
  }

  public async getRepository(accessToken: string, fullName: string): Promise<any> {
    return this.bitbucketReposProvider.getRepository(accessToken, fullName);
  }

  public async downloadRepository(accessToken: string, fullName: string, commit: string): Promise<Buffer> {
    return this.bitbucketReposProvider.downloadRepository(accessToken, fullName, commit);
  }

  public async getWebhooks(accessToken: string, fullName: string): Promise<any> {
    return this.bitbucketReposProvider.getWebhooks(accessToken, fullName);
  }

  public async createWebhook(accessToken: string, fullName: string): Promise<any> {
    const baseUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.BASE_URL);

    let hookUrl = `${baseUrl}/v1/hooks/bitbucket`;
    if (process.env.NODE_ENV === 'development') {
      hookUrl = 'https://smee.io/kyso-bitbucket-hook-test';
    }
    return this.bitbucketReposProvider.createWebhook(accessToken, fullName, {
      description: 'Kyso webhook',
      url: hookUrl,
      active: true,
      events: ['repo:push'],
    });
  }

  public async deleteWebhook(accessToken: string, fullName: string, hookId: number): Promise<any> {
    return this.bitbucketReposProvider.deleteWebhook(accessToken, fullName, hookId);
  }

  public async getBranches(accessToken: string, fullName: string): Promise<any> {
    return this.bitbucketReposProvider.getBranches(accessToken, fullName);
  }

  public async getCommits(accessToken: string, fullName: string, branch: string): Promise<any> {
    return this.bitbucketReposProvider.getCommits(accessToken, fullName, branch);
  }

  public async getRootFilesAndFoldersByCommit(accessToken: string, fullName: string, commit: string, folder: string, pageCode: number): Promise<any> {
    return this.bitbucketReposProvider.getRootFilesAndFoldersByCommit(accessToken, fullName, commit, folder, pageCode);
  }

  public async getFileContent(accessToken: string, fullName: string, commit: string, filePath: string): Promise<any> {
    return this.bitbucketReposProvider.getFileContent(accessToken, fullName, commit, filePath);
  }

  public async getUser(accessToken: string): Promise<any> {
    return this.bitbucketReposProvider.getUser(accessToken);
  }

  public async login(code: string): Promise<any> {
    return this.bitbucketReposProvider.login(code);
  }

  public async refreshToken(refreshToken: string): Promise<any> {
    return this.bitbucketReposProvider.refreshToken(refreshToken);
  }

  public async getEmail(accessToken: string): Promise<BitbucketPaginatedResponse<BitbucketEmail>> {
    return this.bitbucketReposProvider.getEmail(accessToken);
  }
}
