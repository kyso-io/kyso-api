import { Report, Tag, TagAssign, TagRequestDTO } from '@kyso-io/kyso-model'
import { EntityEnum } from '@kyso-io/kyso-model/dist/enums/entity.enum'
import { Injectable, PreconditionFailedException, Provider } from '@nestjs/common'
import { Autowired } from '../../decorators/autowired'
import { AutowiredService } from '../../generic/autowired.generic'
import { ReportsService } from '../reports/reports.service'
import { TagsAssignMongoProvider } from './providers/tags-assign-mongo.provider'
import { TagsMongoProvider } from './providers/tags-mongo.provider'

function factory(service: TagsService) {
    return service
}

export function createProvider(): Provider<TagsService> {
    return {
        provide: `${TagsService.name}`,
        useFactory: (service) => factory(service),
        inject: [TagsService],
    }
}

@Injectable()
export class TagsService extends AutowiredService {
    @Autowired({ typeName: 'ReportsService' })
    private readonly reportsService: ReportsService

    constructor(private readonly provider: TagsMongoProvider, private tagsAssignMongoProvider: TagsAssignMongoProvider) {
        super()
    }

    public async getTagById(id: string): Promise<Tag> {
        return this.getTag({ filter: { _id: this.provider.toObjectId(id) } })
    }

    public async getTag(query: any): Promise<Tag> {
        const tags: Tag[] = await this.provider.read(query)
        if (tags.length === 0) {
            return null
        }
        return tags[0]
    }

    public async getTags(query: any): Promise<Tag[]> {
        return this.provider.read(query)
    }

    public async getTagAssigns(query: any): Promise<TagAssign[]> {
        return this.tagsAssignMongoProvider.read(query)
    }

    public async updateTag(filterQuery: any, updateQuery: any): Promise<Tag> {
        return this.provider.update(filterQuery, updateQuery)
    }

    public async createTag(tagRequestDto: TagRequestDTO): Promise<Tag> {
        const tags: Tag[] = await this.provider.read({ filter: { name: tagRequestDto.name } })
        if (tags.length > 0) {
            throw new PreconditionFailedException(`Tag with name ${tagRequestDto.name} already exists`)
        }
        tagRequestDto.name = tagRequestDto.name.toLowerCase()
        return this.provider.create(tagRequestDto)
    }

    public async deleteTag(tagId: string): Promise<Tag> {
        const tag: Tag = await this.getTagById(tagId)
        if (!tag) {
            throw new PreconditionFailedException('Tag not found')
        }
        await this.provider.deleteOne({ _id: this.provider.toObjectId(tagId) })
        return tag
    }

    public async assignTagToEntity(tagId: string, entityId: string, entityType: EntityEnum): Promise<TagAssign> {
        const tag: Tag = await this.getTagById(tagId)
        if (!tag) {
            throw new PreconditionFailedException('Tag not found')
        }
        switch (entityType) {
            case EntityEnum.REPORT:
                const report: Report = await this.reportsService.getReportById(entityId)
                if (!report) {
                    throw new PreconditionFailedException('Report not found')
                }
                break
            default:
                break
        }
        return this.tagsAssignMongoProvider.create({ tag_id: tagId, entity_id: entityId, type: entityType })
    }

    public async removeTagEntityRelation(tagId: string, entityId: string): Promise<TagAssign> {
        const tag: Tag = await this.getTagById(tagId)
        if (!tag) {
            throw new PreconditionFailedException('Tag not found')
        }
        const tagAssigns: TagAssign[] = await this.tagsAssignMongoProvider.read({ filter: { tag_id: tagId, entity_id: entityId } })
        if (!tagAssigns) {
            throw new PreconditionFailedException('Tag relation not found')
        }
        const tagAssign: TagAssign = tagAssigns[0]
        await this.tagsAssignMongoProvider.deleteOne({ _id: this.provider.toObjectId(tagAssign.id) })
        return tagAssign
    }

    public async getTagsOfEntity(entityId: string, entityType: EntityEnum): Promise<Tag[]> {
        const tagAssigns: TagAssign[] = await this.tagsAssignMongoProvider.read({ filter: { entity_id: entityId, type: entityType } })
        return this.getTags({ filter: { _id: { $in: tagAssigns.map((tagAssign) => this.provider.toObjectId(tagAssign.tag_id)) } } })
    }

    public async getTagAssignsOfTags(tagIds: string[], entityType: EntityEnum): Promise<TagAssign[]> {
        return this.tagsAssignMongoProvider.read({
            filter: {
                tag_id: { $in: tagIds },
                type: entityType,
            },
        })
    }

    public async removeTagRelationsOfEntity(entityId: string): Promise<void> {
        await this.tagsAssignMongoProvider.deleteMany({ entity_id: entityId })
    }
}
