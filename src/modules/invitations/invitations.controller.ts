import { CreateInvitationDto, HEADER_X_KYSO_ORGANIZATION, HEADER_X_KYSO_TEAM, Invitation, NormalizedResponseDTO, Token } from '@kyso-io/kyso-model';
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
import { GenericController } from '../../generic/controller.generic';
import { QueryParser } from '../../helpers/queryParser';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { SolvedCaptchaGuard } from '../auth/guards/solved-captcha.guard';
import { InvitationsService } from './invitations.service';

@ApiTags('invitations')
@ApiExtraModels(Invitation)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('invitations')
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
export class InvitationsController extends GenericController<Invitation> {
  constructor(private readonly invitationsService: InvitationsService) {
    super();
  }

  @Get()
  @ApiNormalizedResponse({
    status: 200,
    description: `Invitations of a team`,
    type: Invitation,
  })
  @ApiParam({
    name: 'teamId',
    required: true,
    description: 'Id of the team to fetch invitations',
    schema: { type: 'string' },
  })
  public async getInvitations(@Req() req): Promise<NormalizedResponseDTO<Invitation[]>> {
    const query = QueryParser.toQueryObject(req.url);
    if (!query.sort) query.sort = { created_at: -1 };
    if (!query.filter) query.filter = {};
    const invitations: Invitation[] = await this.invitationsService.getInvitations(query);
    return new NormalizedResponseDTO(invitations);
  }

  @Get('/:invitationId')
  @ApiOperation({ summary: 'Get an invitation' })
  @ApiParam({
    name: 'invitationId',
    required: true,
    description: 'Id of the invitation to fetch',
    schema: { type: 'string' },
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Invigation of a team`,
    type: Invitation,
  })
  public async getInvitation(@CurrentToken() token: Token, @Param('invitationId') invitationId: string): Promise<NormalizedResponseDTO<Invitation>> {
    const invitation: Invitation = await this.invitationsService.getInvitationOfUser(token.id, invitationId);
    return new NormalizedResponseDTO(invitation);
  }

  @Post()
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Create an invitation`,
    description: `Create an invitation`,
  })
  @ApiBody({
    description: 'Create invitation',
    required: true,
    type: CreateInvitationDto,
    examples: CreateInvitationDto.examples(),
  })
  @ApiNormalizedResponse({
    status: 201,
    description: `Invitation created`,
    type: Invitation,
  })
  public async createInvitation(@CurrentToken() token: Token, @Body() createInvitationDto: CreateInvitationDto): Promise<NormalizedResponseDTO<Invitation>> {
    const createdInvitation: Invitation = await this.invitationsService.createInvitation(token.id, createInvitationDto);
    return new NormalizedResponseDTO(createdInvitation);
  }

  @Patch('/accept-invitation/:invitationId')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Accept an invitation`,
    description: `Accept an invitation`,
  })
  @ApiParam({
    name: 'invitationId',
    required: true,
    description: 'Id of the invitation to accept',
    schema: { type: 'string' },
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Invitation accepted`,
    type: Invitation,
  })
  public async acceptInvitation(@CurrentToken() token: Token, @Param('invitationId') invitationId: string): Promise<NormalizedResponseDTO<Invitation>> {
    const invitation: Invitation = await this.invitationsService.acceptInvitation(token.id, invitationId);
    return new NormalizedResponseDTO(invitation);
  }

  @Patch('/reject-invitation/:invitationId')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Reject an invitation`,
    description: `Reject an invitation`,
  })
  @ApiParam({
    name: 'invitationId',
    required: true,
    description: 'Id of the invitation to reject',
    schema: { type: 'string' },
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Invitation rejected`,
    type: Invitation,
  })
  public async rejectInvitation(@CurrentToken() token: Token, @Param('invitationId') invitationId: string): Promise<NormalizedResponseDTO<Invitation>> {
    const invitation: Invitation = await this.invitationsService.rejectInvitation(token.id, invitationId);
    return new NormalizedResponseDTO(invitation);
  }

  @Delete('/:id')
  @UseGuards(EmailVerifiedGuard, SolvedCaptchaGuard)
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
    const invitation: Invitation = await this.invitationsService.deleteInvitation(id);
    return new NormalizedResponseDTO(invitation);
  }
}
