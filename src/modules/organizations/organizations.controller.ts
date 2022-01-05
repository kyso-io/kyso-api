import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { GenericController } from '../../generic/controller.generic'
import { Organization } from '../../model/organization.model'
import { Permission } from '../auth/annotations/permission.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { OrganizationsService } from './organizations.service'
import { NormalizedResponse } from '../../model/dto/normalized-reponse.dto'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-repose'
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
    @ApiNormalizedResponse({ status: 200, description: `Created organization`, type: Organization })
    @Permission([OrganizationPermissionsEnum.CREATE])
    async createOrganization(@Body() organization: Organization) {
        const data = await this.organizationService.createOrganization(organization)
        return data
    }
}
