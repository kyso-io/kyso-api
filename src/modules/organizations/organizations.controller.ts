import { NormalizedResponseDTO, Organization, OrganizationMember, UpdateOrganizationDTO, UpdateOrganizationMembersDTO } from '@kyso-io/kyso-model'
import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    PreconditionFailedException,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { GenericController } from '../../generic/controller.generic'
import { GlobalPermissionsEnum } from '../../security/general-permissions.enum'
import { Permission } from '../auth/annotations/permission.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { TeamPermissionsEnum } from '../teams/security/team-permissions.enum'
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
    async getOrganization(@Param('organizationId') organizationId: string): Promise<NormalizedResponseDTO<Organization>> {
        const organization: Organization = await this.organizationService.getOrganizationById(organizationId)
        if (!organization) {
            throw new PreconditionFailedException('Organization not found')
        }
        return new NormalizedResponseDTO(organization)
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
    @ApiNormalizedResponse({ status: 200, description: `Organization matching id`, type: Organization })
    @Permission([GlobalPermissionsEnum.GLOBAL_ADMIN])
    public async deleteOrganization(@Param('organizationId') organizationId: string): Promise<NormalizedResponseDTO<Organization>> {
        const organization: Organization = await this.organizationService.deleteOrganization(organizationId)
        return new NormalizedResponseDTO(organization)
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
    async getOrganizationMembers(@Param('organizationId') organizationId: string): Promise<NormalizedResponseDTO<OrganizationMember[]>> {
        const data: OrganizationMember[] = await this.organizationService.getOrganizationMembers(organizationId)
        return new NormalizedResponseDTO(data)
    }

    @Post()
    @ApiOperation({
        summary: `Create a new organization`,
        description: `By passing the appropiate parameters you can create a new organization`,
    })
    @ApiNormalizedResponse({ status: 201, description: `Created organization`, type: Organization })
    @Permission([OrganizationPermissionsEnum.CREATE])
    async createOrganization(@Body() organization: Organization): Promise<NormalizedResponseDTO<Organization>> {
        const newOrganization: Organization = await this.organizationService.createOrganization(organization)
        return new NormalizedResponseDTO(newOrganization)
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
        @Body() updateOrganizationDTO: UpdateOrganizationDTO,
    ): Promise<NormalizedResponseDTO<Organization>> {
        const updatedOrganization: Organization = await this.organizationService.updateOrganization(organizationId, updateOrganizationDTO)
        return new NormalizedResponseDTO(updatedOrganization)
    }

    @Post('/:organizationId/members/:userId')
    @ApiOperation({
        summary: `Add user to an organization`,
        description: `By passing the appropiate parameters you can add a user to an organization`,
    })
    @ApiNormalizedResponse({ status: 201, description: `Added user`, type: OrganizationMember, isArray: true })
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
    ): Promise<NormalizedResponseDTO<OrganizationMember[]>> {
        const members: OrganizationMember[] = await this.organizationService.addMemberToOrganization(organizationId, userId)
        return new NormalizedResponseDTO(members)
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
    @ApiNormalizedResponse({ status: 200, description: `Added user`, type: OrganizationMember, isArray: true })
    @Permission([OrganizationPermissionsEnum.ADMIN])
    public async removeMemberFromOrganization(
        @Param('organizationId') organizationId,
        @Param('userId') userId: string,
    ): Promise<NormalizedResponseDTO<boolean>> {
        const members: OrganizationMember[] = await this.organizationService.removeMemberFromOrganization(organizationId, userId)
        return new NormalizedResponseDTO(members)
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
    public async UpdateOrganizationMembersDTORoles(
        @Param('organizationId') organizationId: string,
        @Body() data: UpdateOrganizationMembersDTO,
    ): Promise<NormalizedResponseDTO<OrganizationMember[]>> {
        const organizationMembers: OrganizationMember[] = await this.organizationService.UpdateOrganizationMembersDTORoles(organizationId, data)
        return new NormalizedResponseDTO(organizationMembers)
    }

    @Delete('/:organizationId/members-roles/:userId/:role')
    @ApiOperation({
        summary: `Remove a user's role in an organization`,
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
    ): Promise<NormalizedResponseDTO<OrganizationMember[]>> {
        const members: OrganizationMember[] = await this.organizationService.removeOrganizationMemberRole(organizationId, userId, role)
        return new NormalizedResponseDTO(members)
    }

    @UseInterceptors(
        FileInterceptor('file', {
            fileFilter: (req, file, callback) => {
                if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
                    return callback(new Error('Only image files are allowed!'), false)
                }
                callback(null, true)
            },
        }),
    )
    @Post('/:organizationId/profile-picture')
    @ApiOperation({
        summary: `Upload a profile picture for a organization`,
        description: `Allows uploading a profile picture for a organization passing its id and image`,
    })
    @ApiParam({
        name: 'organizationId',
        required: true,
        description: `Id of the organization to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 201, description: `Updated organization`, type: Organization })
    @Permission([TeamPermissionsEnum.EDIT])
    public async setProfilePicture(@Param('organizationId') organizationId: string, @UploadedFile() file: any): Promise<NormalizedResponseDTO<Organization>> {
        if (!file) {
            throw new BadRequestException(`Missing file`)
        }
        const organization: Organization = await this.organizationService.setProfilePicture(organizationId, file)
        return new NormalizedResponseDTO(organization)
    }

    @Delete('/:organizationId/profile-picture')
    @ApiOperation({
        summary: `Delete a profile picture for a organization`,
        description: `Allows deleting a profile picture for a organization passing its id`,
    })
    @ApiParam({
        name: 'organizationId',
        required: true,
        description: `Id of the organization to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Updated organization`, type: Organization })
    public async deleteBackgroundImage(@Param('organizationId') organizationId: string): Promise<NormalizedResponseDTO<Organization>> {
        const organization: Organization = await this.organizationService.deleteProfilePicture(organizationId)
        return new NormalizedResponseDTO(organization)
    }
}
