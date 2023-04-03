import {
  CreateInlineCommentDto,
  File,
  InlineComment,
  InlineCommentDto,
  InlineCommentStatusEnum,
  InlineCommentStatusHistoryDto,
  Organization,
  Report,
  ResourcePermissions,
  Team,
  Token,
  UpdateInlineCommentDto,
  User,
} from '@kyso-io/kyso-model';
import { ForbiddenException, Injectable, NotFoundException, Provider } from '@nestjs/common';
import { Autowired } from '../../decorators/autowired';
import { AutowiredService } from '../../generic/autowired.generic';
import { db } from '../../main';
import { PlatformRole } from '../../security/platform-roles';
import { BaseCommentsService } from '../comments/base-comments.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { ReportsService } from '../reports/reports.service';
import { TeamsService } from '../teams/teams.service';
import { UsersService } from '../users/users.service';
import { MongoInlineCommentsProvider } from './providers/mongo-inline-comments.provider';

function factory(service: InlineCommentsService) {
  return service;
}

export function createProvider(): Provider<InlineCommentsService> {
  return {
    provide: `${InlineCommentsService.name}`,
    useFactory: (service) => factory(service),
    inject: [InlineCommentsService],
  };
}

@Injectable()
export class InlineCommentsService extends AutowiredService {
  @Autowired({ typeName: 'ReportsService' })
  private reportsService: ReportsService;

  @Autowired({ typeName: 'TeamsService' })
  private teamsService: TeamsService;

  @Autowired({ typeName: 'OrganizationsService' })
  private organizationsService: OrganizationsService;

  @Autowired({ typeName: 'UsersService' })
  private usersService: UsersService;

  @Autowired({ typeName: 'BaseCommentsService' })
  private baseCommentsService: BaseCommentsService;

  constructor(private readonly provider: MongoInlineCommentsProvider) {
    super();
  }

  public async getInlineComments(query: any): Promise<InlineComment[]> {
    return this.provider.read(query);
  }

  public async deleteReportInlineComments(reportId: string): Promise<void> {
    await this.provider.deleteMany({ report_id: reportId });
  }

  private async getById(id: string): Promise<InlineComment> {
    const inlineComments: InlineComment[] = await this.provider.read({ filter: { _id: this.provider.toObjectId(id) } });
    return inlineComments.length === 1 ? inlineComments[0] : null;
  }

  public async getGivenReportId(report_id: string): Promise<InlineComment[]> {
    return this.provider.read({ filter: { report_id, parent_comment_id: null }, sort: { created_at: 1 } });
  }

  public async createInlineComment(userId: string, createInlineCommentDto: CreateInlineCommentDto): Promise<InlineComment> {
    const report: Report = await this.reportsService.getReportById(createInlineCommentDto.report_id);
    if (!report) {
      throw new NotFoundException(`Report with id ${createInlineCommentDto.report_id} not found`);
    }
    const teams: Team[] = await this.teamsService.getTeamsVisibleForUser(userId);
    const team: Team = teams.find((team) => team.id === report.team_id);
    if (!team) {
      throw new ForbiddenException(`User with id ${userId} is not allowed to create inline comments for report ${report.sluglified_name}`);
    }

    const user: User = await this.usersService.getUserById(userId);
    if (!user) {
      throw new NotFoundException(`User with id ${userId} was not found`);
    }

    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
    if (!organization) {
      throw new NotFoundException(`Organization with id ${team.organization_id} was not found`);
    }

    const report_last_version: number = await this.reportsService.getLastVersionOfReport(report.id);

    const inlineComment: InlineComment = new InlineComment(
      report.id,
      createInlineCommentDto.cell_id,
      userId,
      createInlineCommentDto.text,
      false,
      false,
      createInlineCommentDto.mentions,
      createInlineCommentDto.parent_comment_id,
      report_last_version,
      InlineCommentStatusEnum.OPEN,
    );
    const inlineCommentStatusHistoryDto: InlineCommentStatusHistoryDto = new InlineCommentStatusHistoryDto(new Date(), null, InlineCommentStatusEnum.OPEN, userId, report_last_version);
    inlineComment.status_history = [inlineCommentStatusHistoryDto];
    const result = await this.provider.create(inlineComment);

    this.baseCommentsService.sendCreateCommentNotifications(user, organization, team, inlineComment, report, null);

    this.baseCommentsService.checkMentionsInReportComment(report.id, userId, createInlineCommentDto.mentions);

    return result;
  }

  public async updateInlineComment(token: Token, id: string, updateInlineCommentDto: UpdateInlineCommentDto): Promise<InlineComment> {
    const inlineComment: InlineComment = await this.getById(id);

    if (!inlineComment) {
      throw new NotFoundException(`Inline comment with id ${id} not found`);
    }

    const report: Report = await this.reportsService.getReportById(inlineComment.report_id);
    if (!report) {
      throw new NotFoundException(`Report with id ${inlineComment.report_id} not found`);
    }

    const team: Team = await this.teamsService.getTeamById(report.team_id);
    if (!team) {
      throw new NotFoundException(`Team with id ${report.team_id} not found`);
    }

    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
    if (!organization) {
      throw new NotFoundException(`Organization with id ${team.organization_id} not found`);
    }

    const user: User = await this.usersService.getUserById(inlineComment.user_id);
    if (!user) {
      throw new NotFoundException(`User with id ${inlineComment.user_id} was not found`);
    }

    if (inlineComment.user_id !== token.id) {
      let isOrgAdmin = false;
      const organizationResourcePermissions: ResourcePermissions | undefined = token.permissions.organizations.find(
        (organizationResourcePermissions: ResourcePermissions) => organizationResourcePermissions.id === organization.id,
      );
      if (organizationResourcePermissions) {
        isOrgAdmin = organizationResourcePermissions.role_names.includes(PlatformRole.ORGANIZATION_ADMIN_ROLE.name);
      }
      let isTeamAdmin = false;
      const teamResourcePermissions: ResourcePermissions | undefined = token.permissions.teams.find((teamResourcePermissions: ResourcePermissions) => teamResourcePermissions.id === team.id);
      if (teamResourcePermissions) {
        isTeamAdmin = teamResourcePermissions.role_names.includes(PlatformRole.TEAM_ADMIN_ROLE.name);
      }

      if (!isOrgAdmin && !isTeamAdmin && !token.isGlobalAdmin()) {
        throw new ForbiddenException(`User with id ${token.id} is not allowed to update inline comment ${id}`);
      }
    }

    const report_last_version: number = await this.reportsService.getLastVersionOfReport(report.id);
    const status_history: InlineCommentStatusHistoryDto[] = [...inlineComment.status_history];
    if (inlineComment.current_status !== updateInlineCommentDto.status) {
      status_history.unshift(new InlineCommentStatusHistoryDto(new Date(), inlineComment.current_status, updateInlineCommentDto.status, token.id, report_last_version));
    }

    const updateResult: InlineComment = await this.provider.update(
      {
        _id: this.provider.toObjectId(inlineComment.id),
      },
      {
        $set: {
          edited: inlineComment.text !== updateInlineCommentDto.text,
          text: updateInlineCommentDto.text,
          current_status: updateInlineCommentDto.status,
          status_history,
        },
      },
    );

    this.baseCommentsService.sendUpdateCommentNotifications(user, organization, team, inlineComment, report, null);
    this.baseCommentsService.checkMentionsInReportComment(report.id, user.id, inlineComment.mentions);

    return updateResult;
  }

  public async deleteInlineComment(token: Token, id: string): Promise<boolean> {
    const inlineComment: InlineComment = await this.getById(id);

    if (!inlineComment) {
      throw new NotFoundException(`Inline comment with id ${id} not found`);
    }

    const report: Report = await this.reportsService.getReportById(inlineComment.report_id);
    if (!report) {
      throw new NotFoundException(`Report with id ${inlineComment.report_id} not found`);
    }

    const team: Team = await this.teamsService.getTeamById(report.team_id);
    if (!team) {
      throw new NotFoundException(`Team with id ${report.team_id} not found`);
    }

    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
    if (!organization) {
      throw new NotFoundException(`Organization with id ${team.organization_id} not found`);
    }

    const user: User = await this.usersService.getUserById(inlineComment.user_id);
    if (!user) {
      throw new NotFoundException(`User with id ${inlineComment.user_id} was not found`);
    }

    if (inlineComment.user_id !== token.id) {
      let isOrgAdmin = false;
      const organizationResourcePermissions: ResourcePermissions | undefined = token.permissions.organizations.find(
        (organizationResourcePermissions: ResourcePermissions) => organizationResourcePermissions.id === organization.id,
      );
      if (organizationResourcePermissions) {
        isOrgAdmin = organizationResourcePermissions.role_names.includes(PlatformRole.ORGANIZATION_ADMIN_ROLE.name);
      }
      let isTeamAdmin = false;
      const teamResourcePermissions: ResourcePermissions | undefined = token.permissions.teams.find((teamResourcePermissions: ResourcePermissions) => teamResourcePermissions.id === team.id);
      if (teamResourcePermissions) {
        isTeamAdmin = teamResourcePermissions.role_names.includes(PlatformRole.TEAM_ADMIN_ROLE.name);
      }
      if (!isOrgAdmin && !isTeamAdmin && !token.isGlobalAdmin()) {
        throw new ForbiddenException(`User with id ${token.id} is not allowed to delete this inline comment`);
      }
    }

    await this.provider.deleteMany({ $or: [{ _id: this.provider.toObjectId(id) }, { parent_comment_id: id }] });

    this.baseCommentsService.sendDeleteCommentNotifications(user, organization, team, inlineComment, report, null);

    return true;
  }

  public async inlineCommentModelToInlineCommentDto(inlineComment: InlineComment): Promise<InlineCommentDto> {
    const user: User = await this.usersService.getUserById(inlineComment.user_id);
    const inlineCommentDto: InlineCommentDto = new InlineCommentDto(
      inlineComment.id,
      inlineComment.created_at,
      inlineComment.updated_at,
      inlineComment.report_id,
      inlineComment.cell_id,
      inlineComment.user_id,
      inlineComment.text,
      inlineComment.edited,
      inlineComment.markedAsDeleted,
      user.name,
      user.avatar_url,
      inlineComment.mentions,
      inlineComment.parent_comment_id,
      inlineComment.report_version,
      inlineComment.current_status,
    );
    inlineCommentDto.status_history = inlineComment.status_history;
    if (!inlineComment.parent_comment_id) {
      const inlineComments: InlineComment[] = await this.provider.read({ filter: { parent_comment_id: inlineComment.id }, sort: { created_at: 1 } });
      inlineCommentDto.inline_comments = await Promise.all(inlineComments.map((ic: InlineComment) => this.inlineCommentModelToInlineCommentDto(ic)));
    }
    return inlineCommentDto;
  }

  public async checkInlineComments(report_id: string): Promise<void> {
    const report_version: number = await this.reportsService.getLastVersionOfReport(report_id);
    if (report_version === 1) {
      return;
    }
    const files_previous_version: File[] = await db
      .collection('File')
      .find({ report_id, version: report_version - 1 })
      .toArray();
    const files_current_version: File[] = await db.collection('File').find({ report_id, version: report_version }).toArray();
    for (const file_previous_version of files_previous_version) {
      const file_current_version: File | undefined = files_current_version.find((file: File) => file.name === file_previous_version.name);
      if (!file_current_version) {
        // File was deleted in current version
        continue;
      }
      const inline_comments_previous_version: InlineComment[] = await this.provider.read({
        filter: {
          report_id,
          report_version: file_previous_version.version,
          parent_comment_id: null,
          current_status: {
            $ne: InlineCommentStatusEnum.CLOSED,
          },
        },
      });
      for (const inline_comment_previous_version of inline_comments_previous_version) {
        let inline_comment_current_version: InlineComment = new InlineComment(
          report_id,
          file_previous_version.id === inline_comment_previous_version.cell_id ? file_current_version.id : inline_comment_previous_version.cell_id,
          inline_comment_previous_version.user_id,
          inline_comment_previous_version.text,
          inline_comment_previous_version.edited,
          inline_comment_previous_version.markedAsDeleted,
          inline_comment_previous_version.mentions,
          null,
          report_version,
          inline_comment_previous_version.current_status,
        );
        inline_comment_current_version.status_history = [...inline_comment_previous_version.status_history];
        inline_comment_current_version = await this.provider.create(inline_comment_current_version);
        // Check if inline comment has replies
        const inline_comments_replies_previous_version: InlineComment[] = await this.provider.read({
          filter: {
            report_id,
            report_version: file_previous_version.version,
            parent_comment_id: inline_comment_previous_version.id,
          },
        });
        for (const inline_comment_reply_previous_version of inline_comments_replies_previous_version) {
          let inline_comment_reply_current_version: InlineComment = new InlineComment(
            report_id,
            file_previous_version.id === inline_comment_reply_previous_version.cell_id ? file_current_version.id : inline_comment_reply_previous_version.cell_id,
            inline_comment_reply_previous_version.user_id,
            inline_comment_reply_previous_version.text,
            inline_comment_reply_previous_version.edited,
            inline_comment_reply_previous_version.markedAsDeleted,
            inline_comment_reply_previous_version.mentions,
            inline_comment_current_version.id,
            report_version,
            inline_comment_reply_previous_version.current_status,
          );
          inline_comment_reply_current_version = await this.provider.create(inline_comment_reply_current_version);
        }
      }
    }
  }
}
