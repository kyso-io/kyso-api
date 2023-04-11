import { EntityEnum, Organization, OrganizationPermissionsEnum, Report, Tag, TagAssign, Team, TeamPermissionsEnum, Token } from '@kyso-io/kyso-model';
import { ForbiddenException, Injectable, NotFoundException, Provider } from '@nestjs/common';
import { Autowired } from '../../decorators/autowired';
import { AutowiredService } from '../../generic/autowired.generic';
import { AuthService } from '../auth/auth.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { ReportsService } from '../reports/reports.service';
import { TeamsService } from '../teams/teams.service';
import { TagsAssignMongoProvider } from './providers/tags-assign-mongo.provider';
import { TagsMongoProvider } from './providers/tags-mongo.provider';

function factory(service: TagsService) {
  return service;
}

export function createProvider(): Provider<TagsService> {
  return {
    provide: `${TagsService.name}`,
    useFactory: (service) => factory(service),
    inject: [TagsService],
  };
}

@Injectable()
export class TagsService extends AutowiredService {
  @Autowired({ typeName: 'ReportsService' })
  private readonly reportsService: ReportsService;

  @Autowired({ typeName: 'OrganizationsService' })
  private organizationsService: OrganizationsService;

  @Autowired({ typeName: 'TeamsService' })
  private teamsService: TeamsService;

  constructor(private readonly provider: TagsMongoProvider, private tagsAssignMongoProvider: TagsAssignMongoProvider) {
    super();
  }

  public async getTagById(id: string): Promise<Tag> {
    return this.getTag({ filter: { _id: this.provider.toObjectId(id) } });
  }

  public async getTag(query: any): Promise<Tag> {
    const tags: Tag[] = await this.provider.read(query);
    if (tags.length === 0) {
      return null;
    }
    return tags[0];
  }

  public async getTags(query: any): Promise<Tag[]> {
    return this.provider.read(query);
  }

  public async getTagAssigns(query: any): Promise<TagAssign[]> {
    return this.tagsAssignMongoProvider.read(query);
  }

  public async updateTag(filterQuery: any, updateQuery: any): Promise<Tag> {
    return this.provider.update(filterQuery, updateQuery);
  }

  public async createTag(newTag: Tag): Promise<Tag> {
    const tag: Tag = await this.getTag({
      filter: {
        organization_id: newTag.organization_id,
        team_id: newTag.team_id,
        name: newTag.name,
      },
    });
    return tag ?? this.provider.create(newTag);
  }

  public async deleteTag(token: Token, tagId: string): Promise<Tag> {
    const tag: Tag = await this.getTagById(tagId);
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    const organization: Organization = await this.organizationsService.getOrganizationById(tag.organization_id);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    if (tag.team_id) {
      const team: Team = await this.teamsService.getTeamById(tag.team_id);
      if (!team) {
        throw new NotFoundException('Team not found');
      }
      const hasPermissions: boolean = AuthService.hasPermissions(token, [TeamPermissionsEnum.ADMIN], team, organization);
      if (!hasPermissions) {
        throw new ForbiddenException('You do not have permission to delete this tag');
      }
    } else {
      const hasPermissions: boolean = AuthService.hasPermissions(token, [OrganizationPermissionsEnum.ADMIN], null, organization);
      if (!hasPermissions) {
        throw new ForbiddenException('You do not have permission to delete this tag');
      }
    }
    await this.provider.deleteOne({ _id: this.provider.toObjectId(tagId) });
    await this.tagsAssignMongoProvider.deleteMany({ tag_id: tagId });
    return tag;
  }

  public async assignTagToEntity(tagId: string, entityId: string, entityType: EntityEnum): Promise<TagAssign> {
    const tag: Tag = await this.getTagById(tagId);
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    if (entityType === EntityEnum.REPORT) {
      const report: Report = await this.reportsService.getReportById(entityId);
      if (!report) {
        throw new NotFoundException('Report not found');
      }
    }
    return this.tagsAssignMongoProvider.create({ tag_id: tagId, entity_id: entityId, type: entityType });
  }

  public async removeTagEntityRelation(tagId: string, entityId: string): Promise<TagAssign> {
    const tag: Tag = await this.getTagById(tagId);
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
    const tagAssigns: TagAssign[] = await this.tagsAssignMongoProvider.read({ filter: { tag_id: tagId, entity_id: entityId } });
    if (!tagAssigns) {
      throw new NotFoundException('Tag relation not found');
    }
    const tagAssign: TagAssign = tagAssigns[0];
    await this.tagsAssignMongoProvider.deleteOne({ _id: this.provider.toObjectId(tagAssign.id) });
    return tagAssign;
  }

  public async getTagsOfEntity(entityId: string, entityType: EntityEnum): Promise<Tag[]> {
    const tagAssigns: TagAssign[] = await this.tagsAssignMongoProvider.read({ filter: { entity_id: entityId, type: entityType } });
    return this.getTags({ filter: { _id: { $in: tagAssigns.map((tagAssign) => this.provider.toObjectId(tagAssign.tag_id)) } } });
  }

  public async getTagAssignsOfTags(tagIds: string[], entityType: EntityEnum): Promise<TagAssign[]> {
    return this.tagsAssignMongoProvider.read({
      filter: {
        tag_id: { $in: tagIds },
        type: entityType,
      },
    });
  }

  public async removeTagRelationsOfEntity(entityId: string): Promise<void> {
    await this.tagsAssignMongoProvider.deleteMany({ entity_id: entityId });
  }
}
