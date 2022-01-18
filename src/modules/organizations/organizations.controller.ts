import { NormalizedResponse, Organization, OrganizationMember, OrganizationMemberJoin, UpdateOrganizationMembers } from '@kyso-io/kyso-model'
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
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

    @Get('/:organizationName')
    @ApiOperation({
        summary: `Get an organization`,
        description: `Allows fetching content of a specific organization passing its name`,
    })
    @ApiParam({
        name: 'organizationName',
        required: true,
        description: `Name of the organization to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Organization matching name`, type: Organization })
    @Permission([OrganizationPermissionsEnum.READ])
    async getOrganization(@Param('organizationName') organizationName: string) {
        const organization = await this.organizationService.getOrganization({ filter: { name: organizationName } })

        if (organization) {
            return new NormalizedResponse(organization)
        } else {
            return new NormalizedResponse(null)
        }
    }

    @Delete('/:organizationName')
    @ApiOperation({
        summary: `Delete an organization`,
        description: `Allows deleting an organization passing its name`,
    })
    @ApiParam({
        name: 'organizationName',
        required: true,
        description: `Name of the organization to delete`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Organization matching name`, type: Boolean })
    @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
    public async deleteOrganization(@Param('organizationName') name: string): Promise<NormalizedResponse> {
        const deleted: boolean = await this.organizationService.deleteOrganization(name)
        return new NormalizedResponse(deleted)
    }

    @Get('/:organizationName/members')
    @ApiOperation({
        summary: `Get all the members of an organization`,
        description: `Allows fetching content of a specific organization passing its name`,
    })
    @ApiParam({
        name: 'organizationName',
        required: true,
        description: `Name of the organization to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Organization matching name`, type: Organization })
    @Permission([OrganizationPermissionsEnum.READ])
    async getOrganizationMembers(@Param('organizationName') name: string) {
        const data = await this.organizationService.getOrganizationMembers(name)
        return new NormalizedResponse(data)
    }

    @Post('')
    @ApiOperation({
        summary: `Create a new organization`,
        description: `By passing the appropiate parameters you can create a new organization`,
    })
    @ApiNormalizedResponse({ status: 201, description: `Created organization`, type: Organization })
    @Permission([OrganizationPermissionsEnum.CREATE])
    async createOrganization(@Body() organization: Organization) {
        const newOrganization: Organization = await this.organizationService.createOrganization(organization)
        return new NormalizedResponse(newOrganization)
    }

    @Patch(':organizationName')
    @ApiOperation({
        summary: `Update an organization`,
        description: `By passing the appropiate parameters you can update an organization`,
    })
    @ApiNormalizedResponse({ status: 200, description: `Updated organization`, type: Organization })
    @Permission([OrganizationPermissionsEnum.EDIT])
    public async updateOrganization(@Param('organizationName') name: string, @Body() organization: Organization): Promise<NormalizedResponse> {
        const updatedOrganization: Organization = await this.organizationService.updateOrganization(name, organization)
        return new NormalizedResponse(updatedOrganization)
    }

    @Post(':organizationName/members/:userName')
    @ApiOperation({
        summary: `Add user to an organization`,
        description: `By passing the appropiate parameters you can add a user to an organization`,
    })
    @ApiNormalizedResponse({ status: 201, description: `Added user`, type: OrganizationMemberJoin })
    @Permission([OrganizationPermissionsEnum.ADMIN])
    public async addMemberToOrganization(@Param('organizationName') organizationName, @Param('userName') userName: string): Promise<NormalizedResponse> {
        const organizationMemberJoin: OrganizationMemberJoin = await this.organizationService.addMemberToOrganization(organizationName, userName)
        return new NormalizedResponse(organizationMemberJoin)
    }

    @Delete(':organizationName/members/:userName')
    @ApiOperation({
        summary: `Remove user to an organization`,
        description: `By passing the appropiate parameters you can remove a user to an organization`,
    })
    @ApiNormalizedResponse({ status: 200, description: `Added user`, type: Boolean })
    @Permission([OrganizationPermissionsEnum.ADMIN])
    public async removeMemberFromOrganization(@Param('organizationName') organizationName, @Param('userName') userName: string): Promise<NormalizedResponse> {
        const result: boolean = await this.organizationService.removeMemberFromOrganization(organizationName, userName)
        return new NormalizedResponse(result)
    }

    @Post(':organizationName/members-roles')
    @ApiOperation({
        summary: `Update the members of an organization`,
        description: `By passing the appropiate parameters you can update the roles of the members of an organization`,
    })
    @ApiNormalizedResponse({ status: 201, description: `Updated organization`, type: OrganizationMember })
    @Permission([OrganizationPermissionsEnum.ADMIN])
    public async updateOrganizationMembersRoles(
        @Param('organizationName') organizationName: string,
        @Body() data: UpdateOrganizationMembers,
    ): Promise<NormalizedResponse> {
        const organizationMembers: OrganizationMember[] = await this.organizationService.updateOrganizationMembersRoles(organizationName, data)
        return new NormalizedResponse(organizationMembers)
    }

    @Delete(':organizationName/members-roles/:userName/:role')
    @ApiOperation({
        summary: `remove a user's role in an organization`,
        description: `By passing the appropiate parameters you can remove a role of a member in an organization`,
    })
    @ApiParam({
        name: 'organizationName',
        required: true,
        description: `Name of the organization to fetch`,
        schema: { type: 'string' },
    })
    @ApiParam({
        name: 'userName',
        required: true,
        description: `Name of the user to fetch`,
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
        @Param('organizationName') organizationName: string,
        @Param('userName') userName: string,
        @Param('role') role: string,
    ): Promise<NormalizedResponse> {
        const result: boolean = await this.organizationService.removeOrganizationMemberRole(organizationName, userName, role)
        return new NormalizedResponse(result)
    }
}
