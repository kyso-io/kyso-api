import { HEADER_X_KYSO_ORGANIZATION, HEADER_X_KYSO_TEAM, NormalizedResponseDTO, Tag, TagAssign, TagRequestDTO } from '@kyso-io/kyso-model'
import { EntityEnum } from '@kyso-io/kyso-model/dist/enums/entity.enum'
import { Body, Controller, Delete, Get, Param, Patch, Post, PreconditionFailedException, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ObjectId } from 'mongodb'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { GenericController } from '../../generic/controller.generic'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { TagsService } from '../tags/tags.service'

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
    constructor(private readonly tagsService: TagsService) {
        super()
    }

    @Get()
    @ApiOperation({
        summary: `Get tags`,
        description: `Allows fetching all tags`,
    })
    @ApiNormalizedResponse({ status: 200, description: `Get all available tags`, type: Tag, isArray: true })
    public async getTags(): Promise<NormalizedResponseDTO<Tag[]>> {
        const tags: Tag[] = await this.tagsService.getTags({})
        return new NormalizedResponseDTO(tags)
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
        const tag: Tag = await this.tagsService.getTagById(id)
        if (!tag) {
            throw new PreconditionFailedException('Tag not found')
        }
        return new NormalizedResponseDTO(tag)
    }

    @Get('/check-name/:name')
    @ApiOperation({
        summary: `Check if tag name is unique`,
        description: `Allows checking if a tag name is unique`,
    })
    @ApiParam({
        name: 'name',
        required: true,
        description: `Name of the tag to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Tag matching name`, type: Boolean })
    public async checkIfTagNameIsUnique(@Param('name') name: string): Promise<NormalizedResponseDTO<boolean>> {
        const tag: Tag = await this.tagsService.getTag({ filter: { name } })
        return new NormalizedResponseDTO<boolean>(tag !== null)
    }

    @Patch('/:tagId')
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
    @ApiNormalizedResponse({
        status: 200,
        description: `Specified tag data`,
        type: Tag,
    })
    public async updateTag(@Param('tagId') tagId: string, @Body() data: TagRequestDTO): Promise<NormalizedResponseDTO<Tag>> {
        const tag: Tag = await this.tagsService.getTagById(tagId)
        if (!tag) {
            throw new PreconditionFailedException('Tag not found')
        }
        const upadtedTag: Tag = await this.tagsService.updateTag({ id: new ObjectId(tagId) }, { $set: data })
        return new NormalizedResponseDTO(upadtedTag)
    }

    @Post()
    @ApiOperation({
        summary: `Create a new tag`,
        description: `Allows creating a new tag`,
    })
    @ApiNormalizedResponse({
        status: 201,
        description: `Created tag`,
        type: Tag,
    })
    public async createTag(@Body() tagRequestDto: TagRequestDTO): Promise<NormalizedResponseDTO<Tag>> {
        const tag: Tag = await this.tagsService.createTag(tagRequestDto)
        return new NormalizedResponseDTO(tag)
    }

    @Delete('/:tagId')
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
    public async deleteTag(@Param('tagId') tagId: string): Promise<NormalizedResponseDTO<Tag>> {
        const tag: Tag = await this.tagsService.deleteTag(tagId)
        return new NormalizedResponseDTO(tag)
    }

    @Post('/:tagId/assign/:entityId/:entityType')
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
    public async assignTagToEntity(
        @Param('tagId') tagId: string,
        @Param('entityId') entityId: string,
        @Param('entityType') entityType: EntityEnum,
    ): Promise<NormalizedResponseDTO<TagAssign>> {
        const tagAssign: TagAssign = await this.tagsService.assignTagToEntity(tagId, entityId, entityType)
        return new NormalizedResponseDTO(tagAssign)
    }

    @Delete('/:tagId/unassign/:entityId')
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
        const tagAssign: TagAssign = await this.tagsService.removeTagEntityRelation(tagId, entityId)
        return new NormalizedResponseDTO(tagAssign)
    }
}