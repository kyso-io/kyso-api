import { GlobalPermissionsEnum, NormalizedResponseDTO } from '@kyso-io/kyso-model';
import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { FormDataRequest } from 'nestjs-form-data';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
import { Permission } from '../auth/annotations/permission.decorator';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { CreateThemeDto } from './create-theme.dto';
import { ThemesService } from './themes.service';

@ApiTags('themes')
@ApiBearerAuth()
@Controller('themes')
@UseGuards(PermissionsGuard)
@Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
export class ThemesController {
  constructor(private themesService: ThemesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get theme in a zip file',
    description: 'Get theme in a zip file',
  })
  public async getAvailableThemes(): Promise<NormalizedResponseDTO<string[]>> {
    const list: string[] = await this.themesService.getAvailableThemes();
    return new NormalizedResponseDTO<string[]>(list);
  }

  @Get(':name')
  @ApiOperation({
    summary: 'Get theme in a zip file',
    description: 'Get theme in a zip file',
  })
  public async downloadTheme(@Param('name') themeName: string, @Res() response: Response): Promise<void> {
    this.themesService.downloadTheme(themeName, response);
  }

  @Post()
  @ApiOperation({
    summary: 'Upload theme in a zip file',
    description: 'Upload theme in a zip file',
  })
  @ApiNormalizedResponse({
    status: 201,
    description: `Theme uploaded`,
    type: Boolean,
  })
  @FormDataRequest()
  public async uploadTheme(@Body() createThemeDto: CreateThemeDto): Promise<NormalizedResponseDTO<boolean>> {
    if (createThemeDto.file.mimetype !== 'application/zip') {
      throw new BadRequestException('File is not a zip file');
    }
    const result: boolean = await this.themesService.uploadTheme(createThemeDto);
    return new NormalizedResponseDTO(result);
  }

  @Put(':name')
  @ApiOperation({
    summary: 'Set theme as default',
    description: 'Set theme as default',
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Theme set as default`,
    type: Boolean,
  })
  public async setDefaultTheme(@Param('name') themeName: string): Promise<NormalizedResponseDTO<boolean>> {
    const result: boolean = await this.themesService.setDefaultTheme(themeName);
    return new NormalizedResponseDTO(result);
  }

  @Delete(':name')
  @ApiOperation({
    summary: 'Delete theme',
    description: 'Delete theme',
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Theme deleted`,
    type: Boolean,
  })
  public async deleteTheme(@Param('name') themeName: string): Promise<NormalizedResponseDTO<boolean>> {
    const result: boolean = await this.themesService.deleteTheme(themeName);
    return new NormalizedResponseDTO(result);
  }
}
