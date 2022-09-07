import {
    AddUserOrganizationDto,
    CreateOrganizationDto,
    GlobalPermissionsEnum,
    InviteUserDto,
    NormalizedResponseDTO,
    Organization,
    OrganizationInfoDto,
    OrganizationMember,
    OrganizationOptions,
    OrganizationPermissionsEnum,
    OrganizationStorageDto,
    PaginatedResponseDto,
    Relations,
    ReportDTO,
    StoragePermissionsEnum,
    TeamMember,
    TeamPermissionsEnum,
    Token,
    UpdateOrganizationDTO,
    UpdateOrganizationMembersDTO,
} from '@kyso-io/kyso-model'
import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    NotFoundException,
    Param,
    Patch,
    Post,
    PreconditionFailedException,
    Query,
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { Public } from 'src/decorators/is-public'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { Autowired } from '../../decorators/autowired'
import { GenericController } from '../../generic/controller.generic'
import { QueryParser } from '../../helpers/queryParser'
import { CurrentToken } from '../auth/annotations/current-token.decorator'
import { Permission } from '../auth/annotations/permission.decorator'
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { SolvedCaptchaGuard } from '../auth/guards/solved-captcha.guard'
import { RelationsService } from '../relations/relations.service'
import { OrganizationsService } from './organizations.service'

@ApiTags('organizations')
@ApiExtraModels(Organization)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController extends GenericController<Organization> {
    @Autowired({ typeName: 'RelationsService' })
    private relationsService: RelationsService

    constructor(private readonly organizationService: OrganizationsService) {
        super()
    }

    @Get()
    @ApiOperation({
        summary: `Get organizations`,
        description: `Allows fetching list of organizations`,
    })
    @Public()
    @ApiNormalizedResponse({ status: 200, description: `List of organizations`, type: Organization, isArray: true })
    async getOrganizations(@CurrentToken() token: Token, @Req() req): Promise<NormalizedResponseDTO<Organization[]>> {
        const query = QueryParser.toQueryObject(req.url)
        if (!query.sort) {
            query.sort = { created_at: -1 }
        }
        query.projection = {
            _id: 1,
            sluglified_name: 1,
            display_name: 1,
            location: 1,
            link: 1,
            bio: 1,
            avatar_url: 1,
            legal_name: 1,
        }
        if (!query.filter) {
            query.filter = {}
        }
        /*
        if (!token.isGlobalAdmin()) {
            const userInOrganizations: OrganizationMemberJoin[] = await this.organizationService.searchMembersJoin({
                filter: {
                    member_id: token.id,
                },
            })
            query.filter._id = {
                $in: userInOrganizations.map((o: OrganizationMemberJoin) => new ObjectId(o.organization_id)),
            }
        }*/
        const organizations: Organization[] = await this.organizationService.getOrganizations(query)
        return new NormalizedResponseDTO(organizations)
    }

    @Get('/info')
    @Public()
    @ApiOperation({
        summary: `Get the number of members, reports, discussions and comments by organization`,
        description: `Allows fetching the number of members, reports, discussions and comments by organization`,
    })
    @ApiNormalizedResponse({ status: 200, description: `Number of members and reports by organization`, type: OrganizationInfoDto })
    public async getNumMembersAndReportsByOrganization(
        @CurrentToken() token: Token,
        @Query('organizationId') organizationId: string,
    ): Promise<NormalizedResponseDTO<OrganizationInfoDto[]>> {
        const organizationInfoDto: OrganizationInfoDto[] = await this.organizationService.getNumMembersAndReportsByOrganization(token, organizationId)
        const relations = await this.relationsService.getRelations(organizationInfoDto)
        return new NormalizedResponseDTO(organizationInfoDto, relations)
    }

    @Get('/:sluglified_name/storage')
    @ApiOperation({
        summary: `Get organization storage`,
        description: `Allows fetching organization storage`,
    })
    @Permission([StoragePermissionsEnum.READ])
    public async getOrganizationStorage(
        @CurrentToken() token: Token,
        @Param('sluglified_name') sluglified_name: string,
    ): Promise<NormalizedResponseDTO<OrganizationStorageDto>> {
        const result: OrganizationStorageDto = await this.organizationService.getOrganizationStorage(token, sluglified_name)
        return new NormalizedResponseDTO(result)
    }

    @Get('/slug/:organizationSlug')
    @Public()
    @ApiOperation({
        summary: `Get an organization given slug`,
        description: `Allows fetching content of a specific organization passing its slug`,
    })
    @ApiParam({
        name: 'organizationSlug',
        required: true,
        description: `Slug of the organization to fetch`,
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({ status: 200, description: `Organization matching id`, type: Organization })
    async getOrganizationBySlug(
        @CurrentToken() token: Token,
        @Param('organizationSlug') organizationSlug: string,
    ): Promise<NormalizedResponseDTO<Organization>> {
        const organization: Organization = await this.organizationService.getOrganization({
            filter: {
                sluglified_name: organizationSlug,
            },
        })
        if (!organization) {
            throw new NotFoundException('Organization not found')
        }
        if (!token) {
            delete organization.billingEmail
            delete organization.stripe_subscription_id
            delete organization.tax_identifier
            delete organization.tax_identifier
            delete organization.options
        }
        return new NormalizedResponseDTO(organization)
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
    async getOrganizationById(@Param('organizationId') organizationId: string): Promise<NormalizedResponseDTO<Organization>> {
        const organization: Organization = await this.organizationService.getOrganizationById(organizationId)
        if (!organization) {
            throw new PreconditionFailedException('Organization not found')
        }
        return new NormalizedResponseDTO(organization)
    }

    @Delete('/:organizationId')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
    public async deleteOrganization(
        @CurrentToken() token: Token,
        @Param('organizationId') organizationId: string,
    ): Promise<NormalizedResponseDTO<Organization>> {
        const organization: Organization = await this.organizationService.deleteOrganization(token, organizationId)
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
    @Public()
    async getOrganizationMembers(@Param('organizationId') organizationId: string): Promise<NormalizedResponseDTO<OrganizationMember[]>> {
        const data: OrganizationMember[] = await this.organizationService.getOrganizationMembers(organizationId)
        return new NormalizedResponseDTO(data)
    }

    @Post('invitation')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Create an invitation`,
        description: `Create an invitation`,
    })
    @Permission([OrganizationPermissionsEnum.ADMIN, TeamPermissionsEnum.ADMIN])
    public async inviteNewUser(
        @CurrentToken() token: Token,
        @Body() inviteUserDto: InviteUserDto,
    ): Promise<NormalizedResponseDTO<{ organizationMembers: OrganizationMember[]; teamMembers: TeamMember[] }>> {
        const result: { organizationMembers: OrganizationMember[]; teamMembers: TeamMember[] } = await this.organizationService.inviteNewUser(
            token,
            inviteUserDto,
        )
        return new NormalizedResponseDTO(result)
    }

    @Post()
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Create a new organization`,
        description: `By passing the appropiate parameters you can create a new organization`,
    })
    @ApiNormalizedResponse({ status: 201, description: `Created organization`, type: Organization })
    async createOrganization(@CurrentToken() token: Token, @Body() createOrganizationDto: CreateOrganizationDto): Promise<NormalizedResponseDTO<Organization>> {
        const organization: Organization = await this.organizationService.createOrganization(token, createOrganizationDto)
        return new NormalizedResponseDTO(organization)
    }

    @Patch('/:organizationId')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Update an organization`,
        description: `By passing the appropiate parameters you can update an organization`,
    })
    @ApiNormalizedResponse({ status: 200, description: `Updated organization`, type: Organization })
    @Permission([OrganizationPermissionsEnum.EDIT])
    public async updateOrganization(
        @CurrentToken() token: Token,
        @Param('organizationId') organizationId: string,
        @Body() updateOrganizationDTO: UpdateOrganizationDTO,
    ): Promise<NormalizedResponseDTO<Organization>> {
        const updatedOrganization: Organization = await this.organizationService.updateOrganization(token, organizationId, updateOrganizationDTO)
        return new NormalizedResponseDTO(updatedOrganization)
    }

    @Patch('/:organizationId/options')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Update organization options`,
        description: `By passing the appropiate parameters you can update an organization's options`,
    })
    @ApiNormalizedResponse({ status: 200, description: `Updated organization`, type: Organization })
    @ApiBody({
        description: 'Organization options',
        required: true,
        type: OrganizationOptions,
        examples: {
            'PingID SAML Configuration': {
                summary: 'Adds PingID SAML Configuration and disables the rest',
                value: {
                    auth: {
                        allow_login_with_kyso: false,
                        allow_login_with_google: false,
                        allow_login_with_github: false,
                        otherProviders: [
                            {
                                type: 'ping_id_saml',
                                options: {
                                    sso_url: 'https://auth.pingone.eu',
                                    environment_code: '0fda3448-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
                                    sp_entity_id: 'kyso-api-entity-id',
                                },
                            },
                        ],
                    },
                },
            },
        },
    })
    @Permission([OrganizationPermissionsEnum.EDIT])
    public async updateOrganizationOptions(
        @Param('organizationId') organizationId: string,
        @Body() organizationOptions: OrganizationOptions,
    ): Promise<NormalizedResponseDTO<Organization>> {
        const updatedOrganization: Organization = await this.organizationService.updateOrganizationOptions(organizationId, organizationOptions)
        return new NormalizedResponseDTO(updatedOrganization)
    }

    @Post('/members')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Add user to an organization`,
        description: `By passing the appropiate parameters you can add a user to an organization`,
    })
    @ApiNormalizedResponse({ status: 201, description: `Added user`, type: OrganizationMember, isArray: false })
    @Permission([OrganizationPermissionsEnum.ADMIN])
    public async addMemberToOrganization(@Body() addUserOrganizationDto: AddUserOrganizationDto): Promise<NormalizedResponseDTO<OrganizationMember[]>> {
        const members: OrganizationMember[] = await this.organizationService.addMemberToOrganization(addUserOrganizationDto)
        return new NormalizedResponseDTO(members)
    }

    @Post('/:organizationName/join/:invitationCode')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Add user to an organization`,
        description: `By passing the appropiate parameters you can add a user to an organization`,
    })
    @ApiNormalizedResponse({ status: 201, description: `Added user`, type: OrganizationMember, isArray: true })
    @ApiParam({
        name: 'organizationName',
        required: true,
        description: `Id of the organization to add the user to`,
        schema: { type: 'string' },
    })
    public async addUserToOrganization(
        @CurrentToken() token: Token,
        @Param('organizationName') organizationName: string,
        @Param('invitationCode') invitationCode: string,
    ): Promise<NormalizedResponseDTO<boolean>> {
        const result: boolean = await this.organizationService.addUserToOrganization(token.id, organizationName, invitationCode)
        return new NormalizedResponseDTO(result)
    }

    @Delete('/:organizationId/members/:userId')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
    @ApiOperation({
        summary: `Remove user from the organization`,
        description: `By passing the appropiate parameters you can remove a user from the organization`,
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
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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

    @UseInterceptors(FileInterceptor('file'))
    @Post('/:organizationId/profile-picture')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
        if (file.mimetype.split('/')[0] !== 'image') {
            throw new BadRequestException(`Only image files are allowed`)
        }
        const organization: Organization = await this.organizationService.setProfilePicture(organizationId, file)
        return new NormalizedResponseDTO(organization)
    }

    @Delete('/:organizationId/profile-picture')
    @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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

    @Public()
    @Get('/:organizationSlug/reports')
    @ApiParam({
        name: 'organizationSlug',
        required: true,
        description: `Slug of the organization to fetch reports`,
        schema: { type: 'string' },
    })
    public async getOrganizationReports(
        @CurrentToken() token: Token,
        @Param('organizationSlug') organizationSlug: string,
        @Query('page') pageStr: string,
        @Query('limit') limitStr: string,
        @Query('sort') sort: string,
    ): Promise<NormalizedResponseDTO<PaginatedResponseDto<ReportDTO>>> {
        let page: number = 1
        if (pageStr && !isNaN(pageStr as any)) {
            page = parseInt(pageStr, 10)
        }
        let limit: number = 30
        if (limitStr && !isNaN(limitStr as any)) {
            limit = parseInt(limitStr, 10)
        }
        const paginatedResponseDto: PaginatedResponseDto<ReportDTO> = await this.organizationService.getOrganizationReports(
            token,
            organizationSlug,
            page,
            limit,
            sort,
        )
        const relations: Relations = await this.relationsService.getRelations(paginatedResponseDto.results, 'report', { Author: 'User' })
        return new NormalizedResponseDTO(paginatedResponseDto, relations)
    }
}
