import { KysoConfigFile, KysoSettingsEnum } from '@kyso-io/kyso-model';
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { Autowired } from '../../../decorators/autowired';
import { KysoSettingsService } from '../../kyso-settings/kyso-settings.service';
import { GitlabFileContent } from '../interfaces/giltab-file-content';
import { GitlabAccessToken } from '../interfaces/gitlab-access-token';
import { GitlabBranch } from '../interfaces/gitlab-branch';
import { GitlabCommit } from '../interfaces/gitlab-commit';
import { GitlabFile } from '../interfaces/gitlab-file';
import { GitlabRepository } from '../interfaces/gitlab-repository';
import { GitlabUser } from '../interfaces/gitlab-user';
import { GitlabUserEmail } from '../interfaces/gitlab-user-email';
import { GitlabWeebHook } from '../interfaces/gitlab-webhook';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { safeLoad } = require('js-yaml');

const KYSO_FILE_REGEX = '[.]?kyso[.](json|yaml)';
const formatters = {
  json: JSON.parse,
  yaml: safeLoad,
};

function parseConfig(format, data): KysoConfigFile {
  let config = {};
  if (formatters[format]) {
    config = formatters[format](data);
  }
  return config as KysoConfigFile;
}

@Injectable()
export class GitlabReposProvider {
  @Autowired({ typeName: 'KysoSettingsService' })
  private kysoSettingsService: KysoSettingsService;

  private readonly URL = 'https://gitlab.com';

  public async getAccessToken(code: string, redirectUri?: string): Promise<GitlabAccessToken> {
    const clientId: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.AUTH_GITLAB_CLIENT_ID);
    if (!clientId || clientId.length === 0) {
      throw new Error('Gitlab client id not found');
    }
    const clientSecret: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.AUTH_GITLAB_CLIENT_SECRET);
    if (!clientSecret || clientSecret.length === 0) {
      throw new Error('Gitlab client secret not found');
    }
    if (!redirectUri) {
      redirectUri = await this.kysoSettingsService.getValue(KysoSettingsEnum.AUTH_GITLAB_REDIRECT_URI);
      if (!redirectUri || redirectUri.length === 0) {
        throw new Error('Gitlab redirect uri not found');
      }
    }
    const url = `${this.URL}/oauth/token?client_id=${clientId}&client_secret=${clientSecret}&code=${code}&grant_type=authorization_code&redirect_uri=${redirectUri}`;
    const result: AxiosResponse<GitlabAccessToken> = await axios.post<GitlabAccessToken>(
      url,
      {},
      {
        headers: { 'content-type': 'application/json' },
      },
    );
    return result.data;
  }

  public async refreshAccessToken(refreshToken: string): Promise<GitlabAccessToken> {
    const clientId: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.AUTH_GITLAB_CLIENT_ID);
    if (!clientId || clientId.length === 0) {
      throw new Error('Gitlab client id not found');
    }
    const clientSecret: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.AUTH_GITLAB_CLIENT_SECRET);
    if (!clientSecret || clientSecret.length === 0) {
      throw new Error('Gitlab client secret not found');
    }
    const redirectUri: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.AUTH_GITLAB_REDIRECT_URI);
    if (!redirectUri || redirectUri.length === 0) {
      throw new Error('Gitlab redirect uri not found');
    }
    const url = `${this.URL}/oauth/token?client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${refreshToken}&grant_type=refresh_token&redirect_uri=${redirectUri}`;
    const result: AxiosResponse<GitlabAccessToken> = await axios.post<GitlabAccessToken>(
      url,
      {},
      {
        headers: { 'content-type': 'application/json' },
      },
    );
    return result.data;
  }

  public async getUser(accessToken: string): Promise<GitlabUser> {
    const url = `${this.URL}/api/v4/user`;
    const result: AxiosResponse<GitlabUser> = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return result.data;
  }

  public async getRepositories(accessToken: string, page: number, per_page: number, search?: string): Promise<GitlabRepository[]> {
    const urlParams = `per_page=${per_page}&page=${page}&order_by=name&sort=asc`;
    const urlSearch = search ? `&search=${search}` : '';
    const url = this.URL + '/api/v4/projects?' + urlParams + urlSearch;
    const result: AxiosResponse<GitlabRepository[]> = await axios.get<GitlabRepository[]>(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return result.data;
  }

  public async getUserRepositories(accessToken: string, userId: number, page: number, per_page: number, search?: string): Promise<GitlabRepository[]> {
    let url = this.URL + '/api/v4/users/' + userId + '/projects' + '?';
    url += 'per_page=' + per_page + '&';
    url += 'page=' + page + '&';
    url += 'order_by=name&sort=asc';
    if (search && search.length > 0) {
      url += '&search=' + search;
    }
    const result: AxiosResponse<GitlabRepository[]> = await axios.get<GitlabRepository[]>(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return result.data;
  }

  public async getRepository(accessToken: string, repositoryId: number | string): Promise<GitlabRepository> {
    const url = `${this.URL}/api/v4/projects/${encodeURIComponent(repositoryId)}`;
    const result: AxiosResponse<GitlabRepository> = await axios.get<GitlabRepository>(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return result.data;
  }

  public async getRepositoryTree(accessToken: string, repositoryId: number, branch: string, path: string, recursive: boolean): Promise<GitlabFile[]> {
    let url = this.URL + '/api/v4/projects/' + encodeURIComponent(repositoryId) + '/repository/tree?';
    if (branch && branch.length > 0) {
      url += 'ref=' + branch;
    }
    if (path) {
      url += (branch && branch.length > 0 ? '&' : '') + 'path=' + path;
    }
    if (recursive) {
      url += '&recursive=true';
    }
    const result: AxiosResponse<GitlabFile[]> = await axios.get<GitlabFile[]>(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return result.data;
  }

  public async getBranches(accessToken: string, repositoryId: number): Promise<GitlabBranch[]> {
    const url = `${this.URL}/api/v4/projects/${encodeURIComponent(repositoryId)}/repository/branches`;
    const result: AxiosResponse<GitlabBranch[]> = await axios.get<GitlabBranch[]>(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return result.data;
  }

  public async getCommits(accessToken: string, repositoryId: number, branch: string): Promise<GitlabCommit[]> {
    let url = this.URL + '/api/v4/projects/' + encodeURIComponent(repositoryId) + '/repository/commits?';
    if (branch && branch.length > 0) {
      url += 'ref_name=' + branch;
    }
    const result: AxiosResponse<GitlabCommit[]> = await axios.get<GitlabCommit[]>(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return result.data;
  }

  public async getUserByAccessToken(accessToken: string): Promise<GitlabUser> {
    const url = `${this.URL}/api/v4/user`;
    const result: AxiosResponse<GitlabUser> = await axios.get<GitlabUser>(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return result.data;
  }

  public async getUserEmails(accessToken: string): Promise<GitlabUserEmail[]> {
    const url = `${this.URL}/api/v4/user/emails`;
    const result: AxiosResponse<GitlabUserEmail[]> = await axios.get<GitlabUserEmail[]>(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return result.data;
  }

  public async getFileContent(accessToken: string, repositoryId: number, path: string, commit: string): Promise<Buffer> {
    let url = this.URL + '/api/v4/projects/' + encodeURIComponent(repositoryId) + '/repository/files/' + path;
    if (commit && commit.length > 0) {
      url += '?ref=' + commit;
    }
    const result: AxiosResponse<GitlabFileContent> = await axios.get<GitlabFileContent>(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return Buffer.from(result.data.content, 'base64');
  }

  public async getConfigFile(accessToken: string, repositoryId: number, commit: string): Promise<KysoConfigFile> {
    const regex = new RegExp(`^${KYSO_FILE_REGEX}$`);
    const files: GitlabFile[] = await this.getRepositoryTree(accessToken, repositoryId, commit, '', false);
    const kysoConfigfile: GitlabFile = files.find((gitlabFile: GitlabFile) => gitlabFile.path.match(regex));
    if (!kysoConfigfile) {
      Logger.error(`No ${KYSO_FILE_REGEX} file found in repository ${repositoryId}`, null, GitlabReposProvider.name);
      return null;
    }
    const content: Buffer = await this.getFileContent(accessToken, repositoryId, kysoConfigfile.path, commit);
    if (!content) {
      Logger.error(`No content found for ${KYSO_FILE_REGEX} file in repository ${repositoryId}`, null, GitlabReposProvider.name);
      return null;
    }
    const format: string = kysoConfigfile.path.split('.').pop();
    return parseConfig(format, content);
  }

  public async downloadRepository(accessToken: string, repositoryId: number | string, commit: string): Promise<Buffer> {
    let url = this.URL + '/api/v4/projects/' + encodeURIComponent(repositoryId) + '/repository/archive.zip';
    if (commit && commit.length > 0) {
      url += '?sha=' + commit;
    }
    const result: AxiosResponse<Buffer> = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      responseType: 'arraybuffer',
    });
    return result.data;
  }

  public async getRepositoryWeebHooks(accessToken: string, repositoryId: number): Promise<GitlabWeebHook[]> {
    const url = `${this.URL}/api/v4/projects/${encodeURIComponent(repositoryId)}/hooks`;
    const result: AxiosResponse<GitlabWeebHook[]> = await axios.get<GitlabWeebHook[]>(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return result.data;
  }

  public async createWebhookGivenRepository(accessToken: string, repositoryId: number | string, webhookUrl: string): Promise<GitlabWeebHook> {
    const url = `${this.URL}/api/v4/projects/${encodeURIComponent(repositoryId)}/hooks`;
    const result: AxiosResponse<GitlabWeebHook> = await axios.post<GitlabWeebHook>(
      url,
      {
        url: webhookUrl,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    return result.data;
  }
}
