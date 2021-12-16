import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger'
import { GenericController } from 'src/generic/controller.generic'
import { Organization } from 'src/model/organization.model'
import { Permission } from '../auth/annotations/permission.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { CreateOrganizationRequest } from './model/create-organization-request.model'
import { OrganizationsService } from './organizations.service'
import { OrganizationPermissionsEnum } from './security/organization-permissions.enum'

@ApiTags('organizations')
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
    @ApiResponse({ status: 200, description: `Organization matching name`, type: Organization })
    @Permission([OrganizationPermissionsEnum.READ])
    async getOrganization(@Param('organizationName') organizationName: string) {
        let organization = await this.organizationService.getOrganization({ filter: { name: organizationName } })

        if (organization) {
            this.assignReferences(organization)
            return organization
        } else {
            return {}
        }
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
    @Permission([OrganizationPermissionsEnum.READ])
    async getOrganizationMembers(@Param('organizationName') name: string) {
        return this.organizationService.getOrganizationMembers(name)
    }

    @Post('')
    @ApiOperation({
        summary: `Create a new organization`,
        description: `By passing the appropiate parameters you can create a new organization`,
    })
    @ApiResponse({ status: 200, description: `Created organization`, type: Organization })
    @Permission([OrganizationPermissionsEnum.CREATE])
    async createOrganization(@Body() organization: CreateOrganizationRequest): Promise<Organization> {
        return this.organizationService.createOrganization(organization)
    }
}
