import { KysoSettingsEnum, UpdateKysoSettingDto } from '@kyso-io/kyso-model';
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as AdmZip from 'adm-zip';
import { Response } from 'express';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Autowired } from '../../decorators/autowired';
import { KysoSettingsService } from '../kyso-settings/kyso-settings.service';
import { SftpService } from '../reports/sftp.service';
import { CreateThemeDto } from './create-theme.dto';

@Injectable()
export class ThemesService {
  @Autowired({ typeName: 'KysoSettingsService' })
  private kysoSettingsService: KysoSettingsService;

  @Autowired({ typeName: 'SftpService' })
  private sftpService: SftpService;

  public async downloadTheme(themeName: string, response: Response): Promise<void> {
    const username: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_PUBLIC_USERNAME);
    const password: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_PUBLIC_PASSWORD);
    const { client } = await this.sftpService.getClient(username, password);
    const sftpDestinationFolder = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_DESTINATION_FOLDER);
    const destinationPath = join(sftpDestinationFolder, 'themes', themeName);
    const existsPath: boolean | string = await client.exists(destinationPath);
    if (!existsPath) {
      Logger.error(`Folder ${themeName} does not exists in SCS`, ThemesService.name);
      const notFoundException: NotFoundException = new NotFoundException(`Theme ${themeName} does not exist`);
      response.status(404).json(notFoundException);
      return;
    }
    const localPath = `${process.env.APP_TEMP_DIR}/${uuidv4()}`;
    if (!existsSync(localPath)) {
      Logger.log(`LOCAL folder '${localPath}' not found. Creating...`, ThemesService.name);
      mkdirSync(localPath, { recursive: true });
      Logger.log(`LOCAL folder '${localPath}' created.`, ThemesService.name);
    }
    const result = await client.downloadDir(destinationPath, localPath);
    await client.end();
    Logger.log(result, ThemesService.name);
    const zip: AdmZip = new AdmZip();
    zip.addLocalFolder(localPath);
    response.set('Content-Disposition', `attachment; filename=${themeName}.zip`);
    response.set('Content-Type', 'application/zip');
    const zipFilePath = join(localPath, `${themeName}.zip`);
    zip.writeZip(zipFilePath);
    response.status(200).download(zipFilePath, `${themeName}.zip`, () => {
      Logger.log(`Theme '${themeName}': zip sent to user`, ThemesService.name);
      rmSync(localPath, { recursive: true, force: true });
      Logger.log(`Theme '${themeName}': LOCAL folder '${localPath}' deleted`, ThemesService.name);
    });
  }

  public async uploadTheme(createThemeDto: CreateThemeDto): Promise<boolean> {
    const username: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_PUBLIC_USERNAME);
    const password: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_PUBLIC_PASSWORD);
    const { client } = await this.sftpService.getClient(username, password);
    const sftpDestinationFolder = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_DESTINATION_FOLDER);
    const destinationPath = join(sftpDestinationFolder, 'themes', createThemeDto.name);
    const existsPath: boolean | string = await client.exists(destinationPath);
    if (existsPath) {
      Logger.log(`Theme ${createThemeDto.name} already exists`, ThemesService.name);
      const result: string = await client.rmdir(destinationPath, true);
      Logger.log(result, ThemesService.name);
    }
    const localPath = `${process.env.APP_TEMP_DIR}/${uuidv4()}`;
    const zip: AdmZip = new AdmZip(createThemeDto.file.buffer);
    zip.extractAllTo(localPath, true);
    Logger.log(`Extracted zip file to ${localPath}`, ThemesService.name);
    const result: string = await client.uploadDir(localPath, destinationPath);
    Logger.log(result, ThemesService.name);
    await client.end();
    return true;
  }

  public async setDefaultTheme(themeName: string): Promise<boolean> {
    const username: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_PUBLIC_USERNAME);
    const password: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_PUBLIC_PASSWORD);
    const { client } = await this.sftpService.getClient(username, password);
    const sftpDestinationFolder = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_DESTINATION_FOLDER);
    const destinationPath = join(sftpDestinationFolder, 'themes', themeName);
    const existsPath: boolean | string = await client.exists(destinationPath);
    if (!existsPath) {
      Logger.error(`Folder ${themeName} does not exists in SCS`, ThemesService.name);
      throw new NotFoundException(`Theme ${themeName} does not exist`);
    }
    const updateKysoSettingDto: UpdateKysoSettingDto = new UpdateKysoSettingDto(themeName);
    await this.kysoSettingsService.updateValue(KysoSettingsEnum.THEME, updateKysoSettingDto);
    return true;
  }

  public async deleteTheme(themeName: string): Promise<boolean> {
    const username: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_PUBLIC_USERNAME);
    const password: string = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_PUBLIC_PASSWORD);
    const { client } = await this.sftpService.getClient(username, password);
    const sftpDestinationFolder = await this.kysoSettingsService.getValue(KysoSettingsEnum.SFTP_DESTINATION_FOLDER);
    const destinationPath = join(sftpDestinationFolder, 'themes', themeName);
    const existsPath: boolean | string = await client.exists(destinationPath);
    if (!existsPath) {
      Logger.error(`Folder ${themeName} does not exists in SCS`, ThemesService.name);
      throw new NotFoundException(`Theme ${themeName} does not exist`);
    }
    const result: string = await client.rmdir(destinationPath, true);
    Logger.log(result, ThemesService.name);
    await client.end();
    return true;
  }
}
