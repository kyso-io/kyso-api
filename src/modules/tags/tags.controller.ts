import { EntityEnum, NormalizedResponseDTO, ResourcePermissions, Tag, TagAssign, TagRequestDTO, Team, TeamVisibilityEnum, Token, TokenPermissions } from '@kyso-io/kyso-model';
import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ObjectId } from 'mongodb';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
import { Autowired } from '../../decorators/autowired';
import { QueryParser } from '../../helpers/queryParser';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { AuthService } from '../auth/auth.service';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { SolvedCaptchaGuard } from '../auth/guards/solved-captcha.guard';
import { TagsService } from '../tags/tags.service';
import { TeamsService } from '../teams/teams.service';

@ApiTags('tags')
@UseGuards(PermissionsGuard)
@ApiExtraModels(Tag)
@ApiBearerAuth()
@Controller('tags')
export class TagsController {
  @Autowired({ typeName: 'TeamsService' })
  private teamsService: TeamsService;

  @Autowired({ typeName: 'AuthService' })
  private authService: AuthService;

  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @ApiOperation({
    summary: `Get tags`,
    description: `Allows fetching all tags`,
  })
  @ApiResponse({
    status: 200,
    description: `Get all available tags`,
    content: {
      json: {
        examples: {
          comment: {
            value: new NormalizedResponseDTO<Tag[]>([Tag.createEmpty()]),
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
            value: new BadRequestException(`organization_id is required`),
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
          orgNoPermission: {
            value: new ForbiddenException('You do not have permissions to get tags for this organization'),
          },
          teamNoPermission: {
            value: new ForbiddenException('You do not have permissions to get tags for this team'),
          },
        },
      },
    },
  })
  public async getTags(@CurrentToken() token: Token, @Req() req: Request): Promise<NormalizedResponseDTO<Tag[]>> {
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
  @ApiResponse({
    status: 200,
    description: `Tag matching id`,
    content: {
      json: {
        examples: {
          comment: {
            value: new NormalizedResponseDTO<Tag>(Tag.createEmpty()),
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
          orgNoPermission: {
            value: new ForbiddenException('You do not have permissions to get this tag for this organization'),
          },
          teamNoPermission: {
            value: new ForbiddenException('You do not have permissions to get this tag for this team'),
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
          notFound: {
            value: new NotFoundException(`Tag not found`),
          },
        },
      },
    },
  })
  @ApiNormalizedResponse({ status: 200, description: `Tag matching id`, type: Tag })
  public async getTagById(@CurrentToken() token: Token, @Param('id') id: string): Promise<NormalizedResponseDTO<Tag>> {
    const tag: Tag = await this.tagsService.getTagById(id);
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
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
    return new NormalizedResponseDTO(tag);
  }

  @Post('/exists')
  @ApiOperation({
    summary: `Check if tag exists`,
    description: `Allows checking if a tag exists`,
  })
  @ApiResponse({
    status: 200,
    description: `Boolean indicates whether a tag exists`,
    content: {
      json: {
        examples: {
          exists: {
            value: new NormalizedResponseDTO<boolean>(true),
          },
          notExist: {
            value: new NormalizedResponseDTO<boolean>(false),
          },
        },
      },
    },
  })
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
    examples: {
      json: {
        value: new TagRequestDTO('Hi there!'),
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Update tag',
    content: {
      json: {
        examples: {
          tag: {
            value: new NormalizedResponseDTO<Tag>(Tag.createEmpty()),
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
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
          orgNoPermission: {
            value: new ForbiddenException('You do not have permissions to update this tag for this organization'),
          },
          teamNoPermission: {
            value: new ForbiddenException('You do not have permissions to update tags for this team'),
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
          tagNotFound: {
            value: new NotFoundException('Tag not found'),
          },
          teamNotFound: {
            value: new NotFoundException('Team not found'),
          },
        },
      },
    },
  })
  public async updateTag(@CurrentToken() token: Token, @Param('tagId') tagId: string, @Body() data: TagRequestDTO): Promise<NormalizedResponseDTO<Tag>> {
    const tag: Tag = await this.tagsService.getTagById(tagId);
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    const tokenPermissions: TokenPermissions = await this.authService.getPermissions(token.username);
    const indexOrganization: number = tokenPermissions.organizations.findIndex((rp: ResourcePermissions) => rp.id === tag.organization_id);
    if (indexOrganization === -1) {
      throw new ForbiddenException('You do not have permissions to get tags for this organization');
    }
    if (tag.team_id) {
      const team: Team = await this.teamsService.getTeamById(tag.team_id);
      if (!team) {
        throw new NotFoundException('Team not found');
      }
      if (team.visibility === TeamVisibilityEnum.PRIVATE) {
        const indexTeam: number = tokenPermissions.teams.findIndex((rp: ResourcePermissions) => rp.organization_id === tag.organization_id && rp.id === tag.team_id);
        if (indexTeam === -1) {
          throw new ForbiddenException('You do not have permissions to update tags for this team');
        }
      }
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
    examples: {
      json: {
        value: new TagRequestDTO('Hi there!'),
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Create tag',
    content: {
      json: {
        examples: {
          tag: {
            value: new NormalizedResponseDTO<Tag>(Tag.createEmpty()),
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
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
          orgNoPermission: {
            value: new ForbiddenException('You do not have permissions to create tags for this organization'),
          },
          teamNoPermission: {
            value: new ForbiddenException('You do not have permissions to create fors this team'),
          },
        },
      },
    },
  })
  public async createTag(@CurrentToken() token: Token, @Body() tag: Tag): Promise<NormalizedResponseDTO<Tag>> {
    const tokenPermissions: TokenPermissions = await this.authService.getPermissions(token.username);
    const indexOrganization: number = tokenPermissions.organizations.findIndex((rp: ResourcePermissions) => rp.id === tag.organization_id);
    if (indexOrganization === -1) {
      throw new ForbiddenException('You do not have permissions to create tags for this organization');
    }
    if (tag.team_id) {
      const indexTeam: number = tokenPermissions.teams.findIndex((rp: ResourcePermissions) => rp.organization_id === tag.organization_id && rp.id === tag.team_id);
      if (indexTeam === -1) {
        throw new ForbiddenException('You do not have permissions to create tags for this team');
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
  @ApiResponse({
    status: 200,
    description: 'Deleted tag',
    content: {
      json: {
        examples: {
          tag: {
            value: new NormalizedResponseDTO<Tag>(Tag.createEmpty()),
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
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
          },
          orgNoPermission: {
            value: new ForbiddenException('You do not have permissions to delete tags for this organization'),
          },
          teamNoPermission: {
            value: new ForbiddenException('You do not have permissions to delete fors this team'),
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
          tagNotFound: {
            value: new NotFoundException('Tag not found'),
          },
          teamNotFound: {
            value: new NotFoundException('Team not found'),
          },
        },
      },
    },
  })
  public async deleteTag(@CurrentToken() token: Token, @Param('tagId') tagId: string): Promise<NormalizedResponseDTO<Tag>> {
    const tokenPermissions: TokenPermissions = await this.authService.getPermissions(token.username);
    const indexOrganization: number = tokenPermissions.organizations.findIndex((rp: ResourcePermissions) => rp.id === tag.organization_id);
    if (indexOrganization === -1) {
      throw new ForbiddenException('You do not have permissions to delete tags for this organization');
    }
    const tag: Tag = await this.tagsService.deleteTag(token, tagId);
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    if (tag.team_id) {
      const indexTeam: number = tokenPermissions.teams.findIndex((rp: ResourcePermissions) => rp.organization_id === tag.organization_id && rp.id === tag.team_id);
      if (indexTeam === -1) {
        throw new ForbiddenException('You do not have permissions to delete tags for this team');
      }
    }
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
  @ApiResponse({
    status: 201,
    description: 'Assign a tag to an entity',
    content: {
      json: {
        examples: {
          tag: {
            value: new NormalizedResponseDTO<TagAssign>(TagAssign.createEmpty()),
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
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
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
          tagNotFound: {
            value: new NotFoundException('Tag not found'),
          },
          reportNotFound: {
            value: new NotFoundException('Report not found'),
          },
        },
      },
    },
  })
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
  @ApiResponse({
    status: 200,
    description: 'Delete relationship between tag and entity',
    content: {
      json: {
        examples: {
          tag: {
            value: new NormalizedResponseDTO<TagAssign>(TagAssign.createEmpty()),
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
          emailNotVerified: {
            value: new ForbiddenException('Email not verified'),
          },
          captchaNotSolved: {
            value: new ForbiddenException('Captcha not solved'),
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
          tagNotFound: {
            value: new NotFoundException('Tag not found'),
          },
          reportNotFound: {
            value: new NotFoundException('Tag relation not found'),
          },
        },
      },
    },
  })
  public async removeTagEntityRelation(@Param('tagId') tagId: string, @Param('entityId') entityId: string): Promise<NormalizedResponseDTO<TagAssign>> {
    const tagAssign: TagAssign = await this.tagsService.removeTagEntityRelation(tagId, entityId);
    return new NormalizedResponseDTO(tagAssign);
  }
}
