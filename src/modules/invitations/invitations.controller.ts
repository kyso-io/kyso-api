import { CreateInvitationDto, Invitation, NormalizedResponseDTO, Token } from '@kyso-io/kyso-model'
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'
import { GenericController } from '../../generic/controller.generic'
import { QueryParser } from '../../helpers/queryParser'
import { CurrentToken } from '../auth/annotations/current-token.decorator'
import { PermissionsGuard } from '../auth/guards/permission.guard'
import { InvitationsService } from './invitations.service'

@ApiTags('invitations')
@ApiExtraModels(Invitation)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('invitations')
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
    public async getInvitations(@Req() req): Promise<NormalizedResponseDTO<Invitation[]>> {
        const query = QueryParser.toQueryObject(req.url)
        if (!query.sort) query.sort = { _created_at: -1 }
        if (!query.filter) query.filter = {}
        const invitations: Invitation[] = await this.invitationsService.getInvitations(query)
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
    public async createInvitation(@CurrentToken() token: Token, @Body() createInvitationDto): Promise<NormalizedResponseDTO<Invitation>> {
        const createdInvitation: Invitation = await this.invitationsService.createInvitation(token.id, createInvitationDto)
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
        type: Invitation,
    })
    public async acceptInvitation(@Param('id') id: string): Promise<NormalizedResponseDTO<Invitation>> {
        const invitation: Invitation = await this.invitationsService.acceptInvitation(id)
        return new NormalizedResponseDTO(invitation)
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
        type: Invitation,
    })
    public async rejectInvitation(@Param('id') id: string): Promise<NormalizedResponseDTO<Invitation>> {
        const invitation: Invitation = await this.invitationsService.rejectInvitation(id)
        return new NormalizedResponseDTO(invitation)
    }

    @Delete('/:id')
    @ApiOperation({
        summary: `Delete an invitation`,
        description: `Delete an invitation`,
    })
    @ApiParam({
        name: 'id',
        required: true,
        description: 'Id of the invitation to delete',
        schema: { type: 'string' },
    })
    @ApiNormalizedResponse({
        status: 200,
        description: `Invitation deleted`,
        type: Boolean,
    })
    public async deleteInvitation(@Param('id') id: string): Promise<NormalizedResponseDTO<boolean>> {
        const invitation: Invitation = await this.invitationsService.deleteInvitation(id)
        return new NormalizedResponseDTO(invitation)
    }
}
