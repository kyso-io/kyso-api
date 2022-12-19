import { KysoSettingsEnum } from '@kyso-io/kyso-model';
import { Injectable, Logger, Provider } from '@nestjs/common';
import { unlinkSync, writeFileSync } from 'fs';
import { extname } from 'path';
import * as sha256File from 'sha256-file';
import { SFTPWrapper } from 'ssh2';
import * as Client from 'ssh2-sftp-client';
import { Autowired } from '../../decorators/autowired';
import { AutowiredService } from '../../generic/autowired.generic';
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service';

function factory(service: SftpService) {
  return service;
}

export function createSftpProvider(): Provider<SftpService> {
  return {
    provide: `${SftpService.name}`,
    useFactory: (service) => factory(service),
    inject: [SftpService],
  };
}

@Injectable()
export class SftpService extends AutowiredService {
  @Autowired({ typeName: 'KysoSettingsService' })
  private kysoSettingsService: KysoSettingsService;

  public async getClient(username: string, password: string): Promise<{ client: Client; sftpWrapper: SFTPWrapper }> {
    try {
      const client: Client = new Client();
      const sftpWrapper: SFTPWrapper = await client.connect({
        host: await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_HOST),
        port: parseInt(await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_PORT), 10),
        username,
        password,
      });
      return { client, sftpWrapper };
    } catch (e) {
      Logger.error(`Failed to connect to SFTP server`, e, KysoSettingsService.name);
      return null;
    }
  }

  public async uploadPublicFileFromPost(file: any): Promise<string> {
    const originalName = file.originalname || file.originalName;
    try {
      const tmpFolder: string = process.env.APP_TEMP_DIR;
      if (!tmpFolder) {
        throw new Error('APP_TEMP_DIR environment variable not defined');
      }
      const tmpFilepath = `${tmpFolder}/${originalName}`;
      writeFileSync(tmpFilepath, file.buffer);
      const sha256: string = sha256File(tmpFilepath);
      const firstFolder: string = sha256.substring(0, 2);
      const secondFolder: string = sha256.substring(2, 4);
      const destinationSftpFolder = `${firstFolder}/${secondFolder}`;
      const fileName = `${sha256}${extname(originalName)}`;
      const fullFilePathSftp = `${destinationSftpFolder}/${fileName}`;
      const username: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_PUBLIC_USERNAME);
      if (!username) {
        throw new Error('SFTP_PUBLIC_USERNAME is not defined');
      }
      const password: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_PUBLIC_PASSWORD);
      if (!password) {
        throw new Error('SFTP_PUBLIC_PASSWORD is not defined');
      }
      const { client } = await this.getClient(username, password);
      if (!client) {
        throw new Error('Failed to connect to SFTP with public client');
      }
      const existsFirstFolder = await client.exists(destinationSftpFolder);
      if (!existsFirstFolder) {
        try {
          await client.mkdir(destinationSftpFolder, true);
        } catch (e) {
          Logger.error(e);
          throw new Error(`Failed to create public folder ${destinationSftpFolder}`);
        }
      }
      const existsFile = await client.exists(fullFilePathSftp);
      if (!existsFile) {
        Logger.log(`Uploading file ${originalName} to ${fullFilePathSftp} in SFTP`, SftpService.name);
        try {
          await client.put(tmpFilepath, fullFilePathSftp);
        } catch (e) {
          Logger.error(`Failed to upload file ${originalName} to ${fullFilePathSftp} in SFTP`, e, SftpService.name);
        }
        Logger.log(`Uploaded file ${originalName} in ${fullFilePathSftp} in SFTP`, SftpService.name);
      }
      await client.end();
      // Remove file from tmp
      unlinkSync(tmpFilepath);
      const scsPublicPrefix: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.STATIC_CONTENT_PUBLIC_PREFIX);
      return `${scsPublicPrefix}/${fullFilePathSftp}`;
    } catch (e) {
      Logger.error(`An error occurred uploading file to public folder in SFTP`, e, SftpService.name);
      throw new Error(e);
    }
  }

  public async uploadPublicFileFromLocalFile(localFilePath: string): Promise<string> {
    try {
      const sha256: string = sha256File(localFilePath);
      const firstFolder: string = sha256.substring(0, 2);
      const secondFolder: string = sha256.substring(2, 4);
      const destinationSftpFolder = `${firstFolder}/${secondFolder}`;
      const fileName = `${sha256}${extname(localFilePath)}`;
      const fullFilePathSftp = `${destinationSftpFolder}/${fileName}`;
      const username: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_PUBLIC_USERNAME);
      if (!username) {
        throw new Error('SFTP_PUBLIC_USERNAME is not defined');
      }
      const password: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_PUBLIC_PASSWORD);
      if (!password) {
        throw new Error('SFTP_PUBLIC_PASSWORD is not defined');
      }
      const { client } = await this.getClient(username, password);
      if (!client) {
        throw new Error('Failed to connect to SFTP with public client');
      }
      const existsFirstFolder = await client.exists(destinationSftpFolder);
      if (!existsFirstFolder) {
        try {
          await client.mkdir(destinationSftpFolder, true);
        } catch (e) {
          Logger.error(e);
          throw new Error(`Failed to create public folder ${destinationSftpFolder}`);
        }
      }
      const existsFile = await client.exists(fullFilePathSftp);
      if (!existsFile) {
        Logger.log(`Uploading file ${localFilePath} to ${fullFilePathSftp} in SFTP`, SftpService.name);
        try {
          await client.put(localFilePath, fullFilePathSftp);
        } catch (e) {
          throw new Error(`Failed to upload file ${localFilePath} to ${fullFilePathSftp} in SFTP`);
        }
        Logger.log(`Uploaded file ${localFilePath} in ${fullFilePathSftp} in SFTP`, SftpService.name);
      }
      await client.end();
      const scsPublicPrefix: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.STATIC_CONTENT_PUBLIC_PREFIX);
      return `${scsPublicPrefix}/${fullFilePathSftp}`;
    } catch (e) {
      Logger.error(`Failed to upload local file to public folder in SFTP`, e, SftpService.name);
      return null;
    }
  }

  public async deletePublicFile(externalPath: string): Promise<void> {
    try {
      const scsPublicPrefix: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.STATIC_CONTENT_PUBLIC_PREFIX);
      const sftpPath = externalPath.replace(scsPublicPrefix, '');
      const username: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_PUBLIC_USERNAME);
      if (!username) {
        throw new Error('SFTP_PUBLIC_USERNAME is not defined');
      }
      const password: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_PUBLIC_PASSWORD);
      if (!password) {
        throw new Error('SFTP_PUBLIC_PASSWORD is not defined');
      }
      const { client } = await this.getClient(username, password);
      if (!client) {
        throw new Error('Failed to connect to SFTP with public client');
      }
      Logger.log(`Removing file ${sftpPath} from SFTP`, SftpService.name);
      let resultDelete: string;
      try {
        resultDelete = await client.delete(sftpPath);
      } catch (e) {
        throw new Error(`Failed to remove file ${sftpPath} from SFTP`);
      }
      Logger.log(`Removed file ${sftpPath} from SFTP: ${resultDelete}`, SftpService.name);
      await client.end();
    } catch (e) {
      Logger.error(`Failed to delete file '${externalPath}' from public folder in SFTP`, e, SftpService.name);
    }
  }
}
