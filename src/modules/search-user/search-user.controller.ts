import { NormalizedResponseDTO, SearchUser, SearchUserDto, Token } from '@kyso-io/kyso-model';
import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
import { GenericController } from '../../generic/controller.generic';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { SearchUserMongoProvider } from './search-user.provider';

@ApiTags('search-user')
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('search-user')
export class SearchUserController extends GenericController<SearchUser> {
  constructor(private searchUserMongoProvider: SearchUserMongoProvider) {
    super();
  }

  @Get()
  @ApiNormalizedResponse({ status: 200, description: `Team matching name`, type: SearchUser })
  @ApiResponse({
    status: 400,
    description: `organization_id is required`,
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
  @ApiNormalizedResponse({
    status: 201,
    description: `Creat/update user search`,
    type: SearchUser,
  })
  @ApiBody({
    description: 'User search',
    required: true,
    type: SearchUserDto,
    examples: SearchUserDto.examples(),
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
  @ApiNormalizedResponse({ status: 200, description: `Delete user search`, type: Boolean })
  @ApiResponse({
    status: 403,
    description: `organization_id is required`,
  })
  public async deleteUserSearch(@CurrentToken() token: Token, @Param('id') id: string): Promise<NormalizedResponseDTO<boolean>> {
    const result: SearchUser[] = await this.searchUserMongoProvider.read({
      filter: {
        _id: this.searchUserMongoProvider.toObjectId(id),
      },
    });
    let deleted = false;
    if (result.length > 0) {
      const searchUser: SearchUser = result[0];
      if (searchUser.user_id !== token.id) {
        throw new BadRequestException('You are not allowed to delete this search');
      }
      await this.searchUserMongoProvider.deleteOne({ _id: this.searchUserMongoProvider.toObjectId(id) });
      deleted = true;
    }
    return new NormalizedResponseDTO(deleted);
  }
}
