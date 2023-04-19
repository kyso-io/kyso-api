import {
  CreateInlineCommentDto,
  HEADER_X_KYSO_ORGANIZATION,
  HEADER_X_KYSO_TEAM,
  InlineComment,
  InlineCommentDto,
  InlineCommentPermissionsEnum,
  NormalizedResponseDTO,
  Relations,
  Report,
  Team,
  TeamVisibilityEnum,
  Token,
  UpdateInlineCommentDto,
} from '@kyso-io/kyso-model';
import { Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
import { Autowired } from '../../decorators/autowired';
import { Public } from '../../decorators/is-public';
import { GenericController } from '../../generic/controller.generic';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { Permission } from '../auth/annotations/permission.decorator';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { SolvedCaptchaGuard } from '../auth/guards/solved-captcha.guard';
import { RelationsService } from '../relations/relations.service';
import { ReportsService } from '../reports/reports.service';
import { TeamsService } from '../teams/teams.service';
import { InlineCommentsService } from './inline-comments.service';

@Controller('inline-comments')
@ApiTags('inline-comments')
@ApiExtraModels(InlineComment)
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
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
export class InlineCommentController extends GenericController<InlineComment> {
  @Autowired({ typeName: 'RelationsService' })
  private relationsService: RelationsService;

  @Autowired({ typeName: 'ReportsService' })
  private reportsService: ReportsService;

  @Autowired({ typeName: 'TeamsService' })
  private teamsService: TeamsService;

  constructor(private readonly inlineCommentsService: InlineCommentsService) {
    super();
  }

  @Get(':reportId')
  @ApiOperation({
    summary: 'Get all inline comments for a report',
    description: 'Get all inline comments for a report',
  })
  @ApiParam({
    name: 'reportId',
    required: true,
    description: 'Id of the report to fetch inline comments',
    schema: { type: 'string' },
  })
  @ApiQuery({
    name: 'file_id',
    required: false,
    description: 'Id of the file to fetch inline comments',
    schema: { type: 'string' },
  })
  @ApiNormalizedResponse({
    status: 200,
    description: `Report matching id`,
    type: InlineCommentDto,
  })
  @ApiParam({
    name: 'reportId',
    required: true,
    description: 'Id of the report to fetch inline comments',
    schema: { type: 'string' },
  })
  @Public()
  async getAll(@CurrentToken() token: Token, @Param('reportId') reportId: string, @Query('file_id') file_id: string): Promise<NormalizedResponseDTO<InlineCommentDto>> {
    const report: Report = await this.reportsService.getReportById(reportId);
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    const team: Team = await this.teamsService.getTeamById(report.team_id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
      if (!token) {
        throw new ForbiddenException('You are not authorized to access this resource');
      }
      const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id);
      const index: number = teams.findIndex((t: Team) => t.id === team.id);
      if (index === -1) {
        throw new ForbiddenException('You are not allowed to see comments of this report');
      }
    }
    const inlineComments: InlineComment[] = await this.inlineCommentsService.getGivenReportId(reportId, file_id);
    const relations: Relations = await this.relationsService.getRelations(inlineComments, 'InlineComment');
    const inlineCommentsDto: InlineCommentDto[] = await Promise.all(
      inlineComments.map((inlineComment: InlineComment) => this.inlineCommentsService.inlineCommentModelToInlineCommentDto(inlineComment)),
    );
    return new NormalizedResponseDTO(inlineCommentsDto, relations);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new inline comment',
    description: 'Create a new inline comment',
  })
  @ApiBody({
    description: 'Create inline comment',
    required: true,
    type: CreateInlineCommentDto,
    examples: CreateInlineCommentDto.examples(),
  })
  @ApiNormalizedResponse({
    status: 200,
    description: 'Inline comment created',
    type: InlineCommentDto,
  })
  @Permission([InlineCommentPermissionsEnum.CREATE])
  async createInlineComment(@CurrentToken() token: Token, @Body() createInlineCommentDto: CreateInlineCommentDto): Promise<NormalizedResponseDTO<InlineCommentDto>> {
    const inlineComment: InlineComment = await this.inlineCommentsService.createInlineComment(token.id, createInlineCommentDto);
    const relations: Relations = await this.relationsService.getRelations(inlineComment, 'InlineComment');
    const inlineCommentDto: InlineCommentDto = await this.inlineCommentsService.inlineCommentModelToInlineCommentDto(inlineComment);
    return new NormalizedResponseDTO(inlineCommentDto, relations);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an inline comment',
    description: 'Update an inline comment',
  })
  @ApiBody({
    description: 'Update inline comment',
    required: true,
    type: UpdateInlineCommentDto,
    examples: UpdateInlineCommentDto.examples(),
  })
  @ApiNormalizedResponse({
    status: 200,
    description: 'Inline comment updated',
    type: InlineCommentDto,
  })
  @Permission([InlineCommentPermissionsEnum.EDIT])
  async updateInlineComment(@CurrentToken() token: Token, @Param('id') id: string, @Body() updateInlineCommentDto: UpdateInlineCommentDto): Promise<NormalizedResponseDTO<InlineCommentDto>> {
    const inlineComment: InlineComment = await this.inlineCommentsService.updateInlineComment(token, id, updateInlineCommentDto);
    const relations: Relations = await this.relationsService.getRelations(inlineComment, 'InlineComment');
    const inlineCommentDto: InlineCommentDto = await this.inlineCommentsService.inlineCommentModelToInlineCommentDto(inlineComment);
    return new NormalizedResponseDTO(inlineCommentDto, relations);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: `Delete an inline comment`,
    description: `Allows deleting an inline comment.`,
  })
  @ApiResponse({ status: 204, description: `Inline comment deleted`, type: Boolean })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'Id of the inline comment to delete',
    schema: { type: 'string' },
  })
  @Permission([InlineCommentPermissionsEnum.DELETE])
  async delete(@CurrentToken() token: Token, @Param('id') id: string): Promise<NormalizedResponseDTO<boolean>> {
    const deleted: boolean = await this.inlineCommentsService.deleteInlineComment(token, id);
    return new NormalizedResponseDTO(deleted);
  }
}
