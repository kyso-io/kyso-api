import {
  EntityEnum,
  HEADER_X_KYSO_ORGANIZATION,
  HEADER_X_KYSO_TEAM,
  NormalizedResponseDTO,
  ResourcePermissions,
  Tag,
  TagAssign,
  TagRequestDTO,
  Team,
  TeamVisibilityEnum,
  Token,
  TokenPermissions,
} from '@kyso-io/kyso-model';
import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, PreconditionFailedException, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ObjectId } from 'mongodb';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
import { Autowired } from '../../decorators/autowired';
import { GenericController } from '../../generic/controller.generic';
import { QueryParser } from '../../helpers/queryParser';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { AuthService } from '../auth/auth.service';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { SolvedCaptchaGuard } from '../auth/guards/solved-captcha.guard';
import { TagsService } from '../tags/tags.service';
import { TeamsService } from '../teams/teams.service';

@ApiTags('tags')
@ApiExtraModels(Tag)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('tags')
@ApiHeader({
  name: HEADER_X_KYSO_ORGANIZATION,
  description: 'active organization (i.e: lightside)',
  required: true,
})
@ApiHeader({
  name: HEADER_X_KYSO_TEAM,
  description: 'active team (i.e: protected-team)',
  required: true,
})
export class TagsController extends GenericController<Tag> {
  @Autowired({ typeName: 'TeamsService' })
  private teamsService: TeamsService;

  @Autowired({ typeName: 'AuthService' })
  private authService: AuthService;

  constructor(private readonly tagsService: TagsService) {
    super();
  }

  @Get()
  @ApiOperation({
    summary: `Get tags`,
    description: `Allows fetching all tags`,
  })
  @ApiNormalizedResponse({ status: 200, description: `Get all available tags`, type: Tag, isArray: true })
  public async getTags(@CurrentToken() token: Token, @Req() req): Promise<NormalizedResponseDTO<Tag[]>> {
    const query = QueryParser.toQueryObject(req.url);
    if (!query.sort) {
      query.sort = { created_at: -1 };
    }
    if (!query.filter) {
      query.filter = {};
    }
    if (!query.filter.hasOwnProperty('organization_id')) {
      throw new BadRequestException('organization_id is required');
    }
    const tokenPermissions: TokenPermissions = await this.authService.getPermissions(token.username);
    const indexOrganization: number = tokenPermissions.organizations.findIndex((rp: ResourcePermissions) => rp.id === query.filter.organization_id);
    if (indexOrganization === -1) {
      throw new ForbiddenException('You do not have permissions to get tags for this organization');
    }
    if (!query.filter.hasOwnProperty('team_id')) {
      const teams: Team[] = await this.teamsService.getTeams({
        filter: {
          organization_id: query.filter.organization_id,
          visibility: TeamVisibilityEnum.PRIVATE,
        },
      });
      if (teams.length > 0) {
        query.filter.team_id = {
          $nin: teams.map((team: Team) => team.id),
        };
      }
    } else {
      const indexTeam: number = tokenPermissions.teams.findIndex((rp: ResourcePermissions) => rp.organization_id === query.filter.organization_id && rp.id === query.filter.team_id);
      if (indexTeam === -1) {
        throw new ForbiddenException('You do not have permissions to get tags for this team');
      }
    }
    if (query.filter.hasOwnProperty('entityId') || query.filter.hasOwnProperty('type')) {
      const filter: any = {};
      if (query.filter.hasOwnProperty('entityId')) {
        filter.entityId = query.filter.entityId;
      }
      if (query.filter.hasOwnProperty('type')) {
        filter.type = query.filter.type;
      }
      const tagAssigns: TagAssign[] = await this.tagsService.getTagAssigns({ filter });
      delete query.filter.entityId;
      delete query.filter.type;
      if (tagAssigns.length > 0) {
        query.filter._id = {
          $in: tagAssigns.map((tagAssign: TagAssign) => new ObjectId(tagAssign.tag_id)),
        };
      }
    }
    if (query?.filter?.$text) {
      const newFilter = { ...query.filter };
      newFilter.name = { $regex: `${query.filter.$text.$search}`, $options: 'i' };
      delete newFilter.$text;
      query.filter = newFilter;
    }
    const tags: Tag[] = await this.tagsService.getTags(query);
    return new NormalizedResponseDTO(tags);
  }

  @Get('/:id')
  @ApiOperation({
    summary: `Get a tag`,
    description: `Allows fetching content of a specific tag passing its id`,
  })
  @ApiParam({
    name: 'id',
    required: true,
    description: `Id of the tag to fetch`,
    schema: { type: 'string' },
  })
  @ApiNormalizedResponse({ status: 200, description: `Tag matching id`, type: Tag })
  public async getTagById(@Param('id') id: string): Promise<NormalizedResponseDTO<Tag>> {
    const tag: Tag = await this.tagsService.getTagById(id);
    if (!tag) {
      throw new PreconditionFailedException('Tag not found');
    }
    return new NormalizedResponseDTO(tag);
  }

  @Post('/exists')
  @ApiOperation({
    summary: `Check if tag exists`,
    description: `Allows checking if a tag exists`,
  })
  @ApiNormalizedResponse({ status: 200, description: `Boolean indicates whether a tag exists`, type: Boolean })
  public async checkIfTagNameIsUnique(@Body() tag: Tag): Promise<NormalizedResponseDTO<boolean>> {
    const filter: any = {
      organization_id: tag.organization_id,
      name: tag.name.toLowerCase(),
    };
    if (tag.team_id) {
      const team: Team = await this.teamsService.getTeamById(tag.team_id);
      if (team.visibility === TeamVisibilityEnum.PRIVATE) {
        filter.team_id = tag.team_id;
      }
    }
    const existsTag: Tag = await this.tagsService.getTag({
      filter,
    });
    return new NormalizedResponseDTO<boolean>(existsTag !== null);
  }

  @Patch('/:tagId')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Update the specified tag`,
    description: `Allows updating content from the specified tag`,
  })
  @ApiParam({
    name: 'tagId',
    required: true,
    description: `Id of the tag to fetch`,
    schema: { type: 'string' },
  })
  @ApiBody({
    description: 'Update tag',
    required: true,
    type: TagRequestDTO,
    examples: TagRequestDTO.examples(),
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Specified tag data`,
    type: Tag,
  })
  public async updateTag(@Param('tagId') tagId: string, @Body() data: TagRequestDTO): Promise<NormalizedResponseDTO<Tag>> {
    const tag: Tag = await this.tagsService.getTagById(tagId);
    if (!tag) {
      throw new PreconditionFailedException('Tag not found');
    }
    const upadtedTag: Tag = await this.tagsService.updateTag({ id: new ObjectId(tagId) }, { $set: data });
    return new NormalizedResponseDTO(upadtedTag);
  }

  @Post()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Create a new tag`,
    description: `Allows creating a new tag`,
  })
  @ApiBody({
    description: 'Create tag',
    required: true,
    type: TagRequestDTO,
    examples: TagRequestDTO.examples(),
  })
  @ApiNormalizedResponse({
    status: 201,
    description: `Created tag`,
    type: Tag,
  })
  public async createTag(@CurrentToken() token: Token, @Body() tag: Tag): Promise<NormalizedResponseDTO<Tag>> {
    const tokenPermissions: TokenPermissions = await this.authService.getPermissions(token.username);
    const indexOrganization: number = tokenPermissions.organizations.findIndex((rp: ResourcePermissions) => rp.id === tag.organization_id);
    if (indexOrganization === -1) {
      throw new ForbiddenException('You do not have permissions to get tags for this organization');
    }
    if (tag.team_id) {
      const indexTeam: number = tokenPermissions.teams.findIndex((rp: ResourcePermissions) => rp.organization_id === tag.organization_id && rp.id === tag.team_id);
      if (indexTeam === -1) {
        throw new ForbiddenException('You do not have permissions to get tags for this team');
      }
    }
    const newTag: Tag = await this.tagsService.createTag(tag);
    return new NormalizedResponseDTO(newTag);
  }

  @Delete('/:tagId')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Delete a tag`,
    description: `Allows deleting a tag passing its id`,
  })
  @ApiParam({
    name: 'tagId',
    required: true,
    description: `Id of the tag to delete`,
    schema: { type: 'string' },
  })
  @ApiNormalizedResponse({ status: 200, description: `Deleted tag`, type: Tag })
  public async deleteTag(@CurrentToken() token: Token, @Param('tagId') tagId: string): Promise<NormalizedResponseDTO<Tag>> {
    const tag: Tag = await this.tagsService.deleteTag(token, tagId);
    return new NormalizedResponseDTO(tag);
  }

  @Post('/:tagId/assign/:entityId/:entityType')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Assign a tag to an entity`,
    description: `Allows assigning a tag to an entity`,
  })
  @ApiParam({
    name: 'tagId',
    required: true,
    description: `Id of the tag to fetch`,
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'entityId',
    required: true,
    description: `Id of the entity to fetch`,
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'entityType',
    required: true,
    description: `Type of the entity to fetch`,
    schema: { type: 'string' },
  })
  @ApiNormalizedResponse({ status: 200, description: `Assign a tag to an entity`, type: TagAssign })
  public async assignTagToEntity(@Param('tagId') tagId: string, @Param('entityId') entityId: string, @Param('entityType') entityType: EntityEnum): Promise<NormalizedResponseDTO<TagAssign>> {
    const tagAssign: TagAssign = await this.tagsService.assignTagToEntity(tagId, entityId, entityType);
    return new NormalizedResponseDTO(tagAssign);
  }

  @Delete('/:tagId/unassign/:entityId')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Assign a tag to an entity`,
    description: `Allows assigning a tag to an entity`,
  })
  @ApiParam({
    name: 'tagId',
    required: true,
    description: `Id of the tag to fetch`,
    schema: { type: 'string' },
  })
  @ApiParam({
    name: 'entityId',
    required: true,
    description: `Id of the entity to fetch`,
    schema: { type: 'string' },
  })
  @ApiNormalizedResponse({ status: 200, description: `Delete relation between tag and entity`, type: TagAssign })
  public async removeTagEntityRelation(@Param('tagId') tagId: string, @Param('entityId') entityId: string): Promise<NormalizedResponseDTO<TagAssign>> {
    const tagAssign: TagAssign = await this.tagsService.removeTagEntityRelation(tagId, entityId);
    return new NormalizedResponseDTO(tagAssign);
  }
}
