import { KysoSettingsEnum, Login, LoginProviderEnum } from '@kyso-io/kyso-model';
import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { Autowired } from '../../decorators/autowired';
import { AuthService } from '../auth/auth.service';
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service';
import { AppData } from './dtos/app-data';
import { CreateBuilderResponse } from './dtos/create-builder-response';
import { CreateDeploymentResponse } from './dtos/create-deployment-response';
import { DeleteBuilderResponse } from './dtos/delete-builder-response';
import { DeleteDeploymentResponse } from './dtos/delete-deployment-response';
import { Message } from './dtos/message';
import { ReadBuilderLogsResponse } from './dtos/read-builder-logs-response';
import { ReadBuilderPhaseResponse } from './dtos/read-builder-phase-response';
import { ReadDeploymentStatus } from './dtos/read-deployment-status';

@Injectable()
export class DataAppsService {
  @Autowired({ typeName: 'AuthService' })
  private authService: AuthService;

  @Autowired({ typeName: 'KysoSettingsService' })
  private kysoSettingsService: KysoSettingsService;

  constructor() {
    setTimeout(async () => {
      return;
      try {
        const login: Login = new Login('n0tiene', LoginProviderEnum.KYSO, 'lo+rey@dev.kyso.io', null);
        const jwtToken: string = await this.authService.login(login);
        const status: string = await this.status();
        console.log({ status });
        // const checkAppMessage: Message = await this.checkApp(jwtToken, '');
        // console.log({ checkAppMessage });
        const appData: AppData = await this.getAppData(jwtToken, '646f381650929d5c611e7c2a');
        console.log(appData);
      } catch (e) {
        console.log(e);
      }
    }, 750);
  }

  private async getHttpClient(jwtToken?: string): Promise<AxiosInstance> {
    const headers: any = {
      'Content-Type': 'application/json',
    };
    if (jwtToken) {
      headers.Cookie = `kyso-jwt-token=${jwtToken}`;
    }
    const baseURL: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.KYSO_DAM_URL);
    return axios.create({
      baseURL,
      headers,
    });
  }

  public async status(): Promise<string> {
    const httpClient: AxiosInstance = await this.getHttpClient(null);
    const url = `/`;
    const response = await httpClient.get<string>(url);
    return response.data;
  }

  public async checkApp(token: string, host: string): Promise<Message> {
    const httpClient: AxiosInstance = await this.getHttpClient(token);
    const url = `/app`;
    const response = await httpClient.get<Message>(url);
    return response.data;
  }

  public async getAppData(token: string, reportId: string): Promise<AppData> {
    const httpClient: AxiosInstance = await this.getHttpClient(token);
    const url = `/app/${reportId}`;
    const response = await httpClient.get<AppData>(url);
    return response.data;
  }

  public async buildCreate(token: string, reportId: string): Promise<CreateBuilderResponse> {
    const httpClient: AxiosInstance = await this.getHttpClient(token);
    const url = `/build/${reportId}/create`;
    const response = await httpClient.get<CreateBuilderResponse>(url);
    return response.data;
  }

  public async buildDelete(token: string, reportId: string): Promise<DeleteBuilderResponse> {
    const httpClient: AxiosInstance = await this.getHttpClient(token);
    const url = `/build/${reportId}/delete`;
    const response = await httpClient.get<DeleteBuilderResponse>(url);
    return response.data;
  }

  public async buildLogs(token: string, reportId: string): Promise<ReadBuilderLogsResponse> {
    const httpClient: AxiosInstance = await this.getHttpClient(token);
    const url = `/build/${reportId}/logs`;
    const response = await httpClient.get<ReadBuilderLogsResponse>(url);
    return response.data;
  }

  public async buildPhase(token: string, reportId: string): Promise<ReadBuilderPhaseResponse> {
    const httpClient: AxiosInstance = await this.getHttpClient(token);
    const url = `/build/${reportId}/phase`;
    const response = await httpClient.get<ReadBuilderPhaseResponse>(url);
    return response.data;
  }

  public async deployCreate(token: string, reportId: string): Promise<CreateDeploymentResponse> {
    const httpClient: AxiosInstance = await this.getHttpClient(token);
    const url = `/deploy/${reportId}/create`;
    const response = await httpClient.get<CreateDeploymentResponse>(url);
    return response.data;
  }

  public async deployDelete(token: string, reportId: string): Promise<DeleteDeploymentResponse> {
    const httpClient: AxiosInstance = await this.getHttpClient(token);
    const url = `/deploy/${reportId}/delete`;
    const response = await httpClient.get<DeleteDeploymentResponse>(url);
    return response.data;
  }

  public async deployStatus(token: string, reportId: string): Promise<ReadDeploymentStatus> {
    const httpClient: AxiosInstance = await this.getHttpClient(token);
    const url = `/deploy/${reportId}/status`;
    const response = await httpClient.get<ReadDeploymentStatus>(url);
    return response.data;
  }

  public async deployLogs(token: string, reportId: string): Promise<any> {
    const httpClient: AxiosInstance = await this.getHttpClient(token);
    const url = `/deploy/${reportId}/logs`;
    const response = await httpClient.get<any>(url);
    return response.data;
  }

  public async imageList(token: string, reportId: string): Promise<string[]> {
    const httpClient: AxiosInstance = await this.getHttpClient(token);
    const url = `/image/${reportId}/list`;
    const response = await httpClient.get<string[]>(url);
    return response.data;
  }

  public async imageDeleteLatestTag(token: string, reportId: string): Promise<Message> {
    const httpClient: AxiosInstance = await this.getHttpClient(token);
    const url = `/image/${reportId}`;
    const response = await httpClient.delete<Message>(url);
    return response.data;
  }

  public async imageDeleteTag(token: string, reportId: string, tag: string): Promise<Message> {
    const httpClient: AxiosInstance = await this.getHttpClient(token);
    const url = `/image/${reportId}/${tag}`;
    const response = await httpClient.delete<Message>(url);
    return response.data;
  }

  public async imageDeleteAll(token: string, reportId: string): Promise<Message> {
    const httpClient: AxiosInstance = await this.getHttpClient(token);
    const url = `/image/${reportId}/all`;
    const response = await httpClient.delete<Message>(url);
    return response.data;
  }

  public async imageDeleteOld(token: string, reportId: string): Promise<Message> {
    const httpClient: AxiosInstance = await this.getHttpClient(token);
    const url = `/image/${reportId}/old`;
    const response = await httpClient.delete<Message>(url);
    return response.data;
  }
}
