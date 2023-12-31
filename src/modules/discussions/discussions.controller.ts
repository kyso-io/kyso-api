import {
  Comment,
  CreateDiscussionRequestDTO,
  Discussion,
  DiscussionPermissionsEnum,
  GlobalPermissionsEnum,
  HEADER_X_KYSO_ORGANIZATION,
  HEADER_X_KYSO_TEAM,
  NormalizedResponseDTO,
  Organization,
  Team,
  TeamVisibilityEnum,
  Token,
  UpdateDiscussionRequestDTO,
} from '@kyso-io/kyso-model';
import { Body, Controller, Delete, ForbiddenException, Get, Headers, NotFoundException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiNormalizedResponse } from '../../decorators/api-normalized-response';
import { Autowired } from '../../decorators/autowired';
import { GenericController } from '../../generic/controller.generic';
import { QueryParser } from '../../helpers/queryParser';
import { CurrentToken } from '../auth/annotations/current-token.decorator';
import { Permission } from '../auth/annotations/permission.decorator';
import { AuthService } from '../auth/auth.service';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { PermissionsGuard } from '../auth/guards/permission.guard';
import { SolvedCaptchaGuard } from '../auth/guards/solved-captcha.guard';
import { CommentsService } from '../comments/comments.service';
import { RelationsService } from '../relations/relations.service';
import { TeamsService } from '../teams/teams.service';
import { DiscussionsService } from './discussions.service';

@ApiTags('discussions')
@ApiExtraModels(Discussion)
@ApiBearerAuth()
@Controller('discussions')
export class DiscussionsController extends GenericController<Discussion> {
  @Autowired({ typeName: 'CommentsService' })
  private commentsService: CommentsService;

  @Autowired({ typeName: 'RelationsService' })
  private relationsService: RelationsService;

  @Autowired({ typeName: 'TeamsService' })
  private teamsService: TeamsService;

  @Autowired({ typeName: 'AuthService' })
  private authService: AuthService;

  constructor(private readonly discussionsService: DiscussionsService) {
    super();
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @ApiOperation({ summary: 'Get all discussions' })
  @ApiNormalizedResponse({ status: 200, description: `Discussion`, type: Discussion, isArray: true })
  @Permission([DiscussionPermissionsEnum.READ])
  public async getDiscussions(@CurrentToken() token: Token, @Req() req): Promise<NormalizedResponseDTO<Discussion[]>> {
    const query = QueryParser.toQueryObject(req.url);
    if (!query.sort) {
      query.sort = { created_at: -1 };
    }
    if (!query.filter) {
      query.filter = {};
    }

    if (!query.filter.hasOwnProperty('team_id') || query.filter.team_id == null || query.filter.team_id === '') {
      const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(token.id);
      query.filter.team_id = { $in: teams.map((team: Team) => team.id) };
      if (token.permissions?.global && token.permissions.global.includes(GlobalPermissionsEnum.GLOBAL_ADMIN)) {
        delete query.filter.team_id;
      }
      if (query?.filter?.organization_id) {
        const organizationTeams: Team[] = await this.teamsService.getTeams({ filter: { organization_id: query.filter.organization_id } });
        query.filter.team_id = { $in: organizationTeams.map((team: Team) => team.id) };
        delete query.filter.organization_id;
      }
    }

    query.filter.mark_delete_at = { $eq: null };
    if (query?.filter?.$text) {
      query.filter.$or = [
        { title: { $regex: `${query.filter.$text.$search}`, $options: 'i' } },
        { main: { $regex: `${query.filter.$text.$search}`, $options: 'i' } },
        { description: { $regex: `${query.filter.$text.$search}`, $options: 'i' } },
      ];
      delete query.filter.$text;
    }
    const discussions: Discussion[] = await this.discussionsService.getDiscussions(query);
    const relations = await this.relationsService.getRelations(discussions, 'discussion', { participants: 'User', assignees: 'User' });
    return new NormalizedResponseDTO(discussions, relations);
  }

  @Get('/:discussionId')
  @ApiOperation({
    summary: 'Get discussion detail from specified id',
    description: 'Get discussion detail from specified id',
  })
  @ApiParam({
    name: 'discussionId',
    required: true,
    description: 'Id of the discussion to fetch',
    schema: { type: 'string' },
    example: 'K1bOzHjEmN',
  })
  @ApiNormalizedResponse({ status: 200, description: `Discussion`, type: Discussion })
  public async getDiscussionGivenTeamIdAndDiscussionNumber(
    @Headers(HEADER_X_KYSO_ORGANIZATION) organizationName: string,
    @Headers(HEADER_X_KYSO_TEAM) teamName: string,
    @CurrentToken() token: Token,
    @Param('discussionId') discussionId: string,
  ): Promise<NormalizedResponseDTO<Discussion>> {
    const discussion: Discussion = await this.discussionsService.getDiscussion({
      filter: { id: discussionId, mark_delete_at: { $eq: null } },
    });
    if (!discussion) {
      throw new NotFoundException('Discussion not found');
    }

    const objects: { organization: Organization; team: Team } = await this.authService.retrieveOrgAndTeamFromSlug(teamName, organizationName);
    if (!objects.organization) {
      throw new NotFoundException('Organization not found');
    }
    if (!objects.team) {
      throw new NotFoundException('Team not found');
    }

    if (objects.team.visibility !== TeamVisibilityEnum.PUBLIC) {
      const hasPermissions: boolean = AuthService.hasPermissions(token, [DiscussionPermissionsEnum.READ], objects.team, objects.organization);

      if (!hasPermissions) {
        throw new ForbiddenException('You do not have permissions to access this report');
      }
    }
    const relations = await this.relationsService.getRelations(discussion, 'discussion', { participants: 'User', assignees: 'User' });
    return new NormalizedResponseDTO(discussion, relations);
  }

  @Get('/:discussionId/comments')
  @ApiOperation({
    summary: `Get discussion's comments`,
    description: `Get discussion's comments`,
  })
  @ApiParam({
    name: 'discussionId',
    required: true,
    description: 'Id of the discussions comments to fetch',
    schema: { type: 'string' },
    example: 'K1bOzHjEmN',
  })
  @ApiNormalizedResponse({ status: 200, description: `Comments related to that discussion`, type: Comment, isArray: true })
  public async getDiscussionCommentsGivenTeamIdAndDiscussionNumber(
    @Headers(HEADER_X_KYSO_ORGANIZATION) organizationName: string,
    @Headers(HEADER_X_KYSO_TEAM) teamName: string,
    @CurrentToken() token: Token,
    @Param('discussionId') discussionId: string,
    @Req() req,
  ): Promise<NormalizedResponseDTO<Comment[]>> {
    const discussion: Discussion = await this.discussionsService.getDiscussionById(discussionId);
    if (!discussion) {
      throw new NotFoundException('Discussion not found');
    }

    const objects: { organization: Organization; team: Team } = await this.authService.retrieveOrgAndTeamFromSlug(organizationName, teamName);
    if (!objects.organization) {
      throw new NotFoundException('Organization not found');
    }
    if (!objects.team) {
      throw new NotFoundException(`Team ${discussion.team_id} not found`);
    }

    if (objects.team.visibility !== TeamVisibilityEnum.PUBLIC) {
      const hasPermissions: boolean = AuthService.hasPermissions(token, [DiscussionPermissionsEnum.READ], objects.team, objects.organization);
      if (!hasPermissions) {
        throw new ForbiddenException('You do not have permissions to access this report');
      }
    }
    const query = QueryParser.toQueryObject(req.url);
    if (!query.sort) {
      query.sort = { created_at: -1 };
    }
    const comments: Comment[] = await this.commentsService.getComments({ filter: { discussion_id: discussionId, mark_delete_at: null }, sort: query.sort });
    const relations = await this.relationsService.getRelations(comments, 'comment');
    return new NormalizedResponseDTO(
      comments.filter((comment: Comment) => !comment.comment_id),
      relations,
    );
  }

  @Post()
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: 'Create discussion',
    description: 'Create discussion',
  })
  @ApiBody({
    description: 'New discussion',
    required: true,
    type: CreateDiscussionRequestDTO,
    examples: CreateDiscussionRequestDTO.examples(),
  })
  @ApiNormalizedResponse({ status: 201, description: `Discussion`, type: Discussion })
  @Permission([DiscussionPermissionsEnum.CREATE])
  public async createDiscussion(@Body() data: CreateDiscussionRequestDTO): Promise<NormalizedResponseDTO<Discussion>> {
    const updatedDiscussion: Discussion = await this.discussionsService.createDiscussion(data);
    const relations = await this.relationsService.getRelations(updatedDiscussion, 'discussion', { participants: 'User', assignees: 'User' });
    return new NormalizedResponseDTO(updatedDiscussion, relations);
  }

  @Patch('/:discussionId')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: 'Update discussion',
    description: 'Update discussion',
  })
  @ApiParam({
    name: 'discussionId',
    required: true,
    description: 'Id of the discussion to update',
    schema: { type: 'string' },
    example: 'K1bOzHjEmN',
  })
  @ApiBody({
    description: 'Update discussion',
    required: true,
    type: UpdateDiscussionRequestDTO,
    examples: UpdateDiscussionRequestDTO.examples(),
  })
  @ApiNormalizedResponse({ status: 200, description: `Discussion`, type: Discussion })
  @Permission([DiscussionPermissionsEnum.EDIT, DiscussionPermissionsEnum.EDIT_ONLY_MINE])
  public async updateDiscussion(@CurrentToken() token: Token, @Param('discussionId') discussionId: string, @Body() data: UpdateDiscussionRequestDTO): Promise<NormalizedResponseDTO<Discussion>> {
    const updatedDiscussion: Discussion = await this.discussionsService.updateDiscussion(token, discussionId, data);
    const relations = await this.relationsService.getRelations(updatedDiscussion, 'discussion', { participants: 'User', assignees: 'User' });
    return new NormalizedResponseDTO(updatedDiscussion, relations);
  }

  @Delete('/:discussionId')
  @UseGuards(PermissionsGuard, EmailVerifiedGuard, SolvedCaptchaGuard)
  @ApiOperation({
    summary: 'Delete discussion',
    description: 'Delete discussion',
  })
  @ApiParam({
    name: 'discussionId',
    required: true,
    description: 'Id of the discussion to delete',
    schema: { type: 'string' },
    example: 'K1bOzHjEmN',
  })
  @ApiNormalizedResponse({ status: 200, description: `Discussion`, type: Discussion })
  @Permission([DiscussionPermissionsEnum.DELETE])
  public async deleteDiscussion(
    @Headers(HEADER_X_KYSO_ORGANIZATION) organizationName: string,
    @Headers(HEADER_X_KYSO_TEAM) teamName: string,
    @CurrentToken() token: Token,
    @Param('discussionId') discussionId: string,
  ): Promise<NormalizedResponseDTO<Discussion>> {
    const discussionData: Discussion = await this.discussionsService.getDiscussionById(discussionId);

    const isOwner = await this.discussionsService.checkOwnership(discussionData, token, organizationName, teamName);

    if (!isOwner) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const deletedDiscussion: Discussion = await this.discussionsService.deleteDiscussion(discussionId);
    return new NormalizedResponseDTO(deletedDiscussion);
  }
}
