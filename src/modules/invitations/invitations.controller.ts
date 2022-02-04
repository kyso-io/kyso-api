import { CreateInvitationDto, Invitation, NormalizedResponseDTO } from '@kyso-io/kyso-model'
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { GenericController } from '../../generic/controller.generic'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { InvitationsService } from './invitations.service'

@ApiTags('invitations')
@ApiExtraModels(Invitation)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('invitation')
export class InvitationsController extends GenericController<Invitation> {
    constructor(private readonly invitationsService: InvitationsService) {
        super()
    }

    @Get()
    @ApiNormalizedResponse({
        status: 200,
        description: `Invigations of a team`,
        type: Invitation,
    })
    @ApiParam({
        name: 'teamId',
        required: true,
        description: 'Id of the team to fetch invitations',
        schema: { type: 'string' },
    })
    public async getInvitations(@Body() body): Promise<NormalizedResponseDTO<Invitation[]>> {
        const invitations: Invitation[] = await this.invitationsService.getInvitations(body)
        return new NormalizedResponseDTO(invitations)
    }

    @Post()
    @ApiOperation({
        summary: `Create an invitation`,
        description: `Create an invitation`,
    })
    @ApiNormalizedResponse({
        status: 201,
        description: `Invitation created`,
        type: Invitation,
    })
    public async createInvitation(@Body() createInvitationDto: CreateInvitationDto): Promise<NormalizedResponseDTO<Invitation>> {
        const createdInvitation: Invitation = await this.invitationsService.createInvitation(createInvitationDto)
        return new NormalizedResponseDTO(createdInvitation)
    }

    @Patch('/accept-invitation/:id')
    @ApiOperation({
        summary: `Accept an invitation`,
        description: `Accept an invitation`,
    })
    @ApiParam({
        name: 'id',
        required: true,
        description: 'Id of the invitation to accept',
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Invitation accepted`,
        type: Boolean,
    })
    public async acceptInvitation(@Param('id') id: string): Promise<NormalizedResponseDTO<boolean>> {
        const result: boolean = await this.invitationsService.acceptInvitation(id)
        return new NormalizedResponseDTO(result)
    }

    @Patch('/reject-invitation/:id')
    @ApiOperation({
        summary: `Reject an invitation`,
        description: `Reject an invitation`,
    })
    @ApiParam({
        name: 'id',
        required: true,
        description: 'Id of the invitation to reject',
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Invitation rejected`,
        type: Boolean,
    })
    public async rejectInvitation(@Param('id') id: string): Promise<NormalizedResponseDTO<boolean>> {
        const result: boolean = await this.invitationsService.rejectInvitation(id)
        return new NormalizedResponseDTO(result)
    }
}
