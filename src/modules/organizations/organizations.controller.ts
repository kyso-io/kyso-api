import { NormalizedResponse, Organization, OrganizationMember, OrganizationMemberJoin, UpdateOrganizationMembers } from '@kyso-io/kyso-model'
import { Body, Controller, Delete, Get, Param, Patch, Post, PreconditionFailedException, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { GenericController } from '../../generic/controller.generic'
import { GlobalPermissionsEnum } from '../../security/general-permissions.enum'
import { Permission } from '../auth/annotations/permission.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { OrganizationsService } from './organizations.service'
import { OrganizationPermissionsEnum } from './security/organization-permissions.enum'

@ApiTags('organizations')
@ApiExtraModels(Organization)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController extends GenericController<Organization> {
    constructor(private readonly organizationService: OrganizationsService) {
        super()
    }

    assignReferences(organization: Organization) {
        // TODO
    }

    @Get('/:organizationId')
    @ApiOperation({
        summary: `Get an organization`,
        description: `Allows fetching content of a specific organization passing its id`,
    })
    @ApiParam({
        name: 'organizationId',
        required: true,
        description: `Id of the organization to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Organization matching id`, type: Organization })
    @Permission([OrganizationPermissionsEnum.READ])
    async getOrganization(@Param('organizationId') organizationId: string): Promise<NormalizedResponse<Organization>> {
        const organization: Organization = await this.organizationService.getOrganizationById(organizationId)
        if (!organization) {
            throw new PreconditionFailedException('Organization not found')
        }
        return new NormalizedResponse(organization)
    }

    @Delete('/:organizationId')
    @ApiOperation({
        summary: `Delete an organization`,
        description: `Allows deleting an organization passing its id`,
    })
    @ApiParam({
        name: 'organizationId',
        required: true,
        description: `Id of the organization to delete`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Organization matching id`, type: Boolean })
    @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
    public async deleteOrganization(@Param('organizationId') organizationId: string): Promise<NormalizedResponse<boolean>> {
        const deleted: boolean = await this.organizationService.deleteOrganization(organizationId)
        return new NormalizedResponse(deleted)
    }

    @Get('/:organizationId/members')
    @ApiOperation({
        summary: `Get all the members of an organization`,
        description: `Allows fetching content of a specific organization passing its id`,
    })
    @ApiParam({
        name: 'organizationId',
        required: true,
        description: `Id of the organization to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Organization members`, type: OrganizationMember, isArray: true })
    @Permission([OrganizationPermissionsEnum.READ])
    async getOrganizationMembers(@Param('organizationId') organizationId: string): Promise<NormalizedResponse<OrganizationMember[]>> {
        const data: OrganizationMember[] = await this.organizationService.getOrganizationMembers(organizationId)
        return new NormalizedResponse(data)
    }

    @Post()
    @ApiOperation({
        summary: `Create a new organization`,
        description: `By passing the appropiate parameters you can create a new organization`,
    })
    @ApiNormalizedResponse({ status: 201, description: `Created organization`, type: Organization })
    @Permission([OrganizationPermissionsEnum.CREATE])
    async createOrganization(@Body() organization: Organization): Promise<NormalizedResponse<Organization>> {
        const newOrganization: Organization = await this.organizationService.createOrganization(organization)
        return new NormalizedResponse(newOrganization)
    }

    @Patch('/:organizationId')
    @ApiOperation({
        summary: `Update an organization`,
        description: `By passing the appropiate parameters you can update an organization`,
    })
    @ApiNormalizedResponse({ status: 200, description: `Updated organization`, type: Organization })
    @Permission([OrganizationPermissionsEnum.EDIT])
    public async updateOrganization(
        @Param('organizationId') organizationId: string,
        @Body() organization: Organization,
    ): Promise<NormalizedResponse<Organization>> {
        const updatedOrganization: Organization = await this.organizationService.updateOrganization(organizationId, organization)
        return new NormalizedResponse(updatedOrganization)
    }

    @Post('/:organizationId/members/:userId')
    @ApiOperation({
        summary: `Add user to an organization`,
        description: `By passing the appropiate parameters you can add a user to an organization`,
    })
    @ApiNormalizedResponse({ status: 201, description: `Added user`, type: OrganizationMemberJoin })
    @ApiParam({
        name: 'organizationId',
        required: true,
        description: `Id of the organization to add the user to`,
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'userId',
        required: true,
        description: `Id of the user to add to the organization`,
        schema: { type: 'string' },
    })
    @Permission([OrganizationPermissionsEnum.ADMIN])
    public async addMemberToOrganization(
        @Param('organizationId') organizationId: string,
        @Param('userId') userId: string,
    ): Promise<NormalizedResponse<OrganizationMemberJoin>> {
        const organizationMemberJoin: OrganizationMemberJoin = await this.organizationService.addMemberToOrganization(organizationId, userId)
        return new NormalizedResponse(organizationMemberJoin)
    }

    @Delete('/:organizationId/members/:userId')
    @ApiOperation({
        summary: `Remove user to an organization`,
        description: `By passing the appropiate parameters you can remove a user to an organization`,
    })
    @ApiParam({
        name: 'organizationId',
        required: true,
        description: `Id of the organization to remove the user from`,
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'userId',
        required: true,
        description: `Id of the user to remove from the organization`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Added user`, type: Boolean })
    @Permission([OrganizationPermissionsEnum.ADMIN])
    public async removeMemberFromOrganization(@Param('organizationId') organizationId, @Param('userId') userId: string): Promise<NormalizedResponse<boolean>> {
        const result: boolean = await this.organizationService.removeMemberFromOrganization(organizationId, userId)
        return new NormalizedResponse(result)
    }

    @Post('/:organizationId/members-roles')
    @ApiOperation({
        summary: `Update the members of an organization`,
        description: `By passing the appropiate parameters you can update the roles of the members of an organization`,
    })
    @ApiParam({
        name: 'organizationId',
        required: true,
        description: `Id of the organization to update the members of`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 201, description: `Updated organization`, type: OrganizationMember, isArray: true })
    @Permission([OrganizationPermissionsEnum.ADMIN])
    public async updateOrganizationMembersRoles(
        @Param('organizationId') organizationId: string,
        @Body() data: UpdateOrganizationMembers,
    ): Promise<NormalizedResponse<OrganizationMember[]>> {
        const organizationMembers: OrganizationMember[] = await this.organizationService.updateOrganizationMembersRoles(organizationId, data)
        return new NormalizedResponse(organizationMembers)
    }

    @Delete('/:organizationId/members-roles/:userId/:role')
    @ApiOperation({
        summary: `remove a user's role in an organization`,
        description: `By passing the appropiate parameters you can remove a role of a member in an organization`,
    })
    @ApiParam({
        name: 'organizationId',
        required: true,
        description: `Id of the organization to fetch`,
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'userId',
        required: true,
        description: `Id of the user to fetch`,
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'role',
        required: true,
        description: `Role of the user to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Updated organization`, type: Boolean })
    @Permission([OrganizationPermissionsEnum.ADMIN])
    public async removeOrganizationMemberRole(
        @Param('organizationId') organizationId: string,
        @Param('userId') userId: string,
        @Param('role') role: string,
    ): Promise<NormalizedResponse<boolean>> {
        const result: boolean = await this.organizationService.removeOrganizationMemberRole(organizationId, userId, role)
        return new NormalizedResponse(result)
    }
}
