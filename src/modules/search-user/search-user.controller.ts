import { NormalizedResponseDTO, SearchUser, SearchUserDto, Token } from '@kyso-io/kyso-model';
import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { SearchUserMongoProvider } from './search-user.provider';

@ApiTags('search-user')
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('search-user')
export class SearchUserController {
  constructor(private searchUserMongoProvider: SearchUserMongoProvider) {}

  @Get()
  @ApiQuery({
    name: 'organization_id',
    required: true,
    description: 'Id of the organization',
    schema: { type: 'string' },
    example: '647f368021b67cfee3131514',
  })
  @ApiQuery({
    name: 'team_id',
    required: false,
    description: 'Id of the team',
    schema: { type: 'string' },
    example: '647f368021b67cfee3131516',
  })
  @ApiResponse({
    status: 200,
    description: 'User search in organization',
    content: {
      json: {
        examples: {
          inlineComments: {
            value: new NormalizedResponseDTO<SearchUser>(SearchUser.createEmpty()),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    content: {
      json: {
        examples: {
          orgIdReq: {
            value: new BadRequestException('organization_id is required'),
          },
        },
      },
    },
  })
  public async getUserSearch(@CurrentToken() token: Token, @Query('organization_id') organization_id: string, @Query('team_id') team_id: string): Promise<NormalizedResponseDTO<SearchUser>> {
    if (!organization_id) {
      throw new BadRequestException('organization_id is required');
    }
    const filter: any = {
      user_id: token.id,
      organization_id: organization_id,
    };
    if (team_id) {
      filter.team_id = team_id;
    }
    let searchUser: SearchUser = null;
    const result: SearchUser[] = await this.searchUserMongoProvider.read({ filter });
    if (result.length > 0) {
      searchUser = result[0];
    }
    return new NormalizedResponseDTO(searchUser);
  }

  @Post()
  @ApiResponse({
    status: 201,
    description: `Creat/update user search`,
    content: {
      json: {
        examples: {
          inlineComments: {
            value: new NormalizedResponseDTO<SearchUser>(SearchUser.createEmpty()),
          },
        },
      },
    },
  })
  @ApiBody({
    description: 'User search',
    required: true,
    examples: {
      json: {
        value: new SearchUserDto('647f368021b67cfee3131514', '647f368021b67cfee3131516', 'COVID-19', {}),
      },
    },
  })
  public async createUserSearch(@CurrentToken() token: Token, @Body() searchUserDto: SearchUserDto): Promise<NormalizedResponseDTO<SearchUser>> {
    const filter: any = {
      user_id: token.id,
      organization_id: searchUserDto.organization_id,
    };
    if (searchUserDto.team_id) {
      filter.team_id = searchUserDto.team_id;
    }
    let searchUser: SearchUser = null;
    const result: SearchUser[] = await this.searchUserMongoProvider.read({ filter });
    if (result.length > 0) {
      searchUser = await this.searchUserMongoProvider.update({ _id: this.searchUserMongoProvider.toObjectId(result[0].id) }, { $set: { ...searchUserDto } });
    } else {
      searchUser = new SearchUser();
      searchUser.user_id = token.id;
      searchUser.organization_id = searchUserDto.organization_id;
      searchUser.team_id = searchUserDto.team_id;
      searchUser.team_id = searchUserDto.team_id;
      searchUser.query = searchUserDto.query;
      searchUser.payload = searchUserDto.payload;
      searchUser = await this.searchUserMongoProvider.create(searchUser);
    }
    return new NormalizedResponseDTO(searchUser);
  }

  @Delete(':id')
  @ApiResponse({
    status: 200,
    description: 'Deleted search',
    content: {
      boolean: {
        examples: {
          result: {
            value: new NormalizedResponseDTO<boolean>(true),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    content: {
      json: {
        examples: {
          forbidden: {
            value: new ForbiddenException('You are not allowed to delete this search'),
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    content: {
      json: {
        examples: {
          searchNotFound: {
            value: new NotFoundException('Search not found'),
          },
        },
      },
    },
  })
  public async deleteUserSearch(@CurrentToken() token: Token, @Param('id') id: string): Promise<NormalizedResponseDTO<boolean>> {
    const result: SearchUser[] = await this.searchUserMongoProvider.read({
      filter: {
        _id: this.searchUserMongoProvider.toObjectId(id),
      },
    });
    if (result.length === 0) {
      throw new NotFoundException('Search not found');
    }
    const searchUser: SearchUser = result[0];
    if (searchUser.user_id !== token.id) {
      throw new ForbiddenException('You are not allowed to delete this search');
    }
    await this.searchUserMongoProvider.deleteOne({ _id: this.searchUserMongoProvider.toObjectId(id) });
    return new NormalizedResponseDTO(true);
  }
}
