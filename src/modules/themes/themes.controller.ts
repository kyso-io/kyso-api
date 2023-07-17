import { GlobalPermissionsEnum, NormalizedResponseDTO } from '@kyso-io/kyso-model';
import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { FormDataRequest, MemoryStoredFile } from 'nestjs-form-data';
import { Permission } from '../auth/annotations/permission.decorator';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { CreateThemeDto } from './create-theme.dto';
import { ThemesService } from './themes.service';

@ApiTags('themes')
@ApiBearerAuth()
@Controller('themes')
@UseGuards(PermissionsGuard)
@Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
@ApiResponse({
  status: 403,
  content: {
    json: {
      examples: {
        forbidden: {
          value: new ForbiddenException(),
        },
      },
    },
  },
})
export class ThemesController {
  constructor(private themesService: ThemesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get theme in a zip file',
    description: 'Get theme in a zip file',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all themes',
    content: {
      json: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<string[]>(['light', 'dark']),
          },
        },
      },
    },
  })
  public async getAvailableThemes(): Promise<NormalizedResponseDTO<string[]>> {
    const list: string[] = await this.themesService.getAvailableThemes();
    return new NormalizedResponseDTO<string[]>(list);
  }

  @Get(':name')
  @ApiParam({
    name: 'name',
    description: 'Name of the theme',
    type: String,
  })
  @ApiOperation({
    summary: 'Get theme in a zip file',
    description: 'Get theme in a zip file',
  })
  @ApiResponse({
    status: 200,
    description: 'Zip theme',
    type: Buffer,
  })
  public async downloadTheme(@Param('name') themeName: string, @Res() response: Response): Promise<void> {
    this.themesService.downloadTheme(themeName, response);
  }

  @Post()
  @ApiOperation({
    summary: 'Upload theme in a zip file',
    description: 'Upload theme in a zip file',
  })
  @ApiBody({
    description: 'Update tag',
    required: true,
    examples: {
      json: {
        value: new CreateThemeDto('dark', new MemoryStoredFile()),
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Theme uploaded',
    content: {
      json: {
        examples: {
          uploaded: {
            value: new NormalizedResponseDTO<boolean>(true),
          },
          notUploaded: {
            value: new NormalizedResponseDTO<boolean>(true),
          },
        },
      },
    },
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
  @ApiParam({
    name: 'name',
    description: 'Name of the theme',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: `Theme set as default`,
    content: {
      json: {
        examples: {
          changed: {
            value: new NormalizedResponseDTO<boolean>(true),
          },
          notChanged: {
            value: new NormalizedResponseDTO<boolean>(true),
          },
        },
      },
    },
  })
  public async setDefaultTheme(@Param('name') themeName: string): Promise<NormalizedResponseDTO<boolean>> {
    const result: boolean = await this.themesService.setDefaultTheme(themeName);
    return new NormalizedResponseDTO(result);
  }

  @Delete(':name')
  @ApiParam({
    name: 'name',
    description: 'Name of the theme',
    type: String,
  })
  @ApiOperation({
    summary: 'Delete theme',
    description: 'Delete theme',
  })
  @ApiResponse({
    status: 200,
    description: `Theme deleted`,
    content: {
      json: {
        examples: {
          changed: {
            value: new NormalizedResponseDTO<boolean>(true),
          },
          notChanged: {
            value: new NormalizedResponseDTO<boolean>(true),
          },
        },
      },
    },
  })
  public async deleteTheme(@Param('name') themeName: string): Promise<NormalizedResponseDTO<boolean>> {
    const result: boolean = await this.themesService.deleteTheme(themeName);
    return new NormalizedResponseDTO(result);
  }
}
