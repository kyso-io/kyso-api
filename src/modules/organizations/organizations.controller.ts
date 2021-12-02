import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { GenericController } from 'src/generic/controller.generic'
import { Organization } from 'src/model/organization.model'
import { CreateOrganizationRequest } from './model/create-organization-request.model'
import { OrganizationsService } from './organizations.service'


@ApiTags('organizations')
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
    @ApiResponse({ status: 200, description: `Organization matching name`, type: Organization })
    async getOrganization(@Param('organizationName') teamName: string) {
        let organization: Organization = new Organization();

        this.assignReferences(organization)

        return organization
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
    @ApiResponse({ status: 200, description: `Organization matching name`, type: Organization })
    async getOrganizationMembers(@Param('organizationName') name: string) {
        return this.organizationService.getOrganizationMembers(name)
    }

    @Post('')
    @ApiOperation({
        summary: `Create a new organization`,
        description: `By passing the appropiate parameters you can create a new organization`,
    })
    @ApiResponse({ status: 200, description: `Created organization`, type: Organization })
    async createOrganization(@Body() organization: CreateOrganizationRequest): Promise<Organization> {
        return this.organizationService.createOrganization(organization)
    }
}
