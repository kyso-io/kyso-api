import {
  CreateInlineCommentDto,
  ElasticSearchIndex,
  File,
  InlineComment,
  InlineCommentDto,
  InlineCommentStatusEnum,
  InlineCommentStatusHistoryDto,
  KysoIndex,
  Organization,
  Report,
  ResourcePermissions,
  Team,
  Token,
  UpdateInlineCommentDto,
  User,
} from '@kyso-io/kyso-model';
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Provider } from '@nestjs/common';
import * as moment from 'moment';
import { Autowired } from '../../decorators/autowired';
import { AutowiredService } from '../../generic/autowired.generic';
import { db } from '../../main';
import { PlatformRole } from '../../security/platform-roles';
import { BaseCommentsService } from '../comments/base-comments.service';
import { FullTextSearchService } from '../full-text-search/full-text-search.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { FilesService } from '../reports/files.service';
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

  @Autowired({ typeName: 'FullTextSearchService' })
  private fullTextSearchService: FullTextSearchService;

  @Autowired({ typeName: 'FilesService' })
  private filesService: FilesService;

  constructor(private readonly provider: MongoInlineCommentsProvider) {
    super();
  }

  public async getInlineComments(query: any): Promise<InlineComment[]> {
    return this.provider.read(query);
  }

  public async countInlineComments(query: any): Promise<number> {
    return this.provider.count(query);
  }

  public async deleteReportInlineComments(reportId: string): Promise<void> {
    await this.provider.deleteMany({ report_id: reportId });
  }

  public async getById(id: string): Promise<InlineComment> {
    const inlineComments: InlineComment[] = await this.provider.read({ filter: { _id: this.provider.toObjectId(id) } });
    return inlineComments.length === 1 ? inlineComments[0] : null;
  }

  public async getGivenReportId(report_id: string, file_id: string): Promise<InlineComment[]> {
    const filter = {
      report_id,
      parent_comment_id: null,
    };
    if (file_id) {
      filter['file_id'] = file_id;
    }
    return this.provider.read({ filter, sort: { created_at: 1 } });
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
      createInlineCommentDto.file_id,
      createInlineCommentDto.cell_id,
      userId,
      createInlineCommentDto.text,
      false,
      false,
      [...createInlineCommentDto.mentions],
      createInlineCommentDto.parent_comment_id,
      report_last_version,
      InlineCommentStatusEnum.OPEN,
    );
    const inlineCommentStatusHistoryDto: InlineCommentStatusHistoryDto = new InlineCommentStatusHistoryDto(new Date(), null, InlineCommentStatusEnum.OPEN, userId, report_last_version, false);
    inlineComment.status_history = [inlineCommentStatusHistoryDto];
    const result = await this.provider.create(inlineComment);

    this.baseCommentsService.sendCreateCommentNotifications('inline-comment', user, organization, team, inlineComment, report, null);

    this.baseCommentsService.checkMentionsInReportComment(report.id, userId, createInlineCommentDto.mentions);

    this.indexInlineComment(inlineComment);

    if (!result.parent_comment_id) {
      // Only inline comments without children
      const numTasks: number = await this.countInlineComments({
        filter: {
          parent_comment_id: null,
          report_id: report.id,
          report_version: report_last_version,
        },
      });
      this.fullTextSearchService.updateNumTasksInKysoIndex(report.id, numTasks);
    }

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

    const hasPermissionToUpdateInlineComment = (): boolean => {
      if (token.isGlobalAdmin()) {
        return true;
      }
      if (inlineComment.user_id === token.id) {
        return true;
      }
      const teamResourcePermissions: ResourcePermissions | undefined = token.permissions.teams.find((x: ResourcePermissions) => x.id === team.id);

      const checkOrgLevel = (): boolean => {
        if (orgResourcePermissions && orgResourcePermissions.role_names) {
          const isOrgAdmin: boolean = orgResourcePermissions.role_names.includes(PlatformRole.ORGANIZATION_ADMIN_ROLE.name);
          if (isOrgAdmin) {
            return true;
          }
          const isTeamAdmin: boolean = orgResourcePermissions.role_names.includes(PlatformRole.TEAM_ADMIN_ROLE.name);
          if (isTeamAdmin) {
            return true;
          }
          const isTeamContributor: boolean = orgResourcePermissions.role_names.includes(PlatformRole.TEAM_CONTRIBUTOR_ROLE.name);
          if (isTeamContributor) {
            return true;
          }
        }
        return false;
      };

      const orgResourcePermissions: ResourcePermissions | undefined = token.permissions.organizations.find((x: ResourcePermissions) => x.id === organization.id);
      if (teamResourcePermissions) {
        if (!teamResourcePermissions.organization_inherited) {
          if (teamResourcePermissions && teamResourcePermissions.role_names) {
            const isOrgAdmin: boolean = teamResourcePermissions.role_names.includes(PlatformRole.ORGANIZATION_ADMIN_ROLE.name);
            if (isOrgAdmin) {
              return true;
            }
            const isTeamAdmin: boolean = teamResourcePermissions.role_names.includes(PlatformRole.TEAM_ADMIN_ROLE.name);
            if (isTeamAdmin) {
              return true;
            }
            const isTeamContributor: boolean = teamResourcePermissions.role_names.includes(PlatformRole.TEAM_CONTRIBUTOR_ROLE.name);
            if (isTeamContributor) {
              return true;
            }
          }
        } else if (checkOrgLevel()) {
          return true;
        }
      } else if (checkOrgLevel()) {
        return true;
      }
      return report.author_ids.includes(user.id);
    };

    const status_history: InlineCommentStatusHistoryDto[] = [...inlineComment.status_history];
    const report_last_version: number = await this.reportsService.getLastVersionOfReport(report.id);
    if (updateInlineCommentDto.text && updateInlineCommentDto.text !== inlineComment.text) {
      if (!hasPermissionToUpdateInlineComment()) {
        throw new ForbiddenException(`User with id ${token.id} is not allowed to update inline comment ${id}`);
      }
      status_history.unshift(new InlineCommentStatusHistoryDto(new Date(), inlineComment.current_status, inlineComment.current_status, token.id, report_last_version, true));
    }
    let statusChanged = false;
    if (inlineComment.current_status !== updateInlineCommentDto.status) {
      if (!hasPermissionToUpdateInlineComment()) {
        throw new ForbiddenException(`User with id ${token.id} is not allowed to update inline comment ${id}`);
      }
      statusChanged = true;
      status_history.unshift(new InlineCommentStatusHistoryDto(new Date(), inlineComment.current_status, updateInlineCommentDto.status, token.id, report_last_version, false));
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
          orphan: updateInlineCommentDto.orphan,
        },
      },
    );

    if (statusChanged) {
      this.baseCommentsService.sendInlineCommentsStatusChanged(user, organization, team, updateResult, report);
    } else {
      this.baseCommentsService.sendUpdateCommentNotifications('inline-comment', user, organization, team, updateResult, report, null);
    }

    this.baseCommentsService.checkMentionsInReportComment(report.id, user.id, inlineComment.mentions);

    Logger.log(`Updating comment '${updateResult.id}' of user '${updateResult.user_id}' in Elasticsearch...`, InlineCommentsService.name);
    const kysoIndex: KysoIndex | null = await this.inlineCommentToKysoIndex(updateResult);
    if (kysoIndex) {
      this.fullTextSearchService.updateDocument(kysoIndex);
    }

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

    const report_version: number = await this.reportsService.getLastVersionOfReport(report.id);
    if (inlineComment.report_version !== report_version) {
      throw new BadRequestException(`Inline comment can not be deleted because belong to an old version of the report`);
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

    const isAuthor: boolean = inlineComment.user_id === token.id;
    let isOrgAdmin = false;
    let isTeamAdmin = false;
    const organizationResourcePermissions: ResourcePermissions | undefined = token.permissions.organizations.find(
      (organizationResourcePermissions: ResourcePermissions) => organizationResourcePermissions.id === organization.id,
    );
    if (organizationResourcePermissions) {
      isOrgAdmin = organizationResourcePermissions.role_names.includes(PlatformRole.ORGANIZATION_ADMIN_ROLE.name);
      isTeamAdmin = organizationResourcePermissions.role_names.includes(PlatformRole.TEAM_ADMIN_ROLE.name);
    }
    const teamResourcePermissions: ResourcePermissions | undefined = token.permissions.teams.find((teamResourcePermissions: ResourcePermissions) => teamResourcePermissions.id === team.id);
    if (teamResourcePermissions) {
      isTeamAdmin = isTeamAdmin || teamResourcePermissions.role_names.includes(PlatformRole.TEAM_ADMIN_ROLE.name);
    }
    if (!token.isGlobalAdmin() && !isOrgAdmin && !isTeamAdmin && !report.author_ids.includes(token.id) && !isAuthor) {
      throw new ForbiddenException(`User with id ${token.id} is not allowed to delete this inline comment`);
    }

    await this.provider.deleteMany({ $or: [{ _id: this.provider.toObjectId(id) }, { parent_comment_id: id }] });

    const userAction: User = await this.usersService.getUserById(token.id);
    this.baseCommentsService.sendDeleteCommentNotifications('inline-comment', userAction, organization, team, inlineComment, report, null);

    Logger.log(`Deleting inline comment '${inlineComment.id}' of user '${inlineComment.user_id}' in ElasticSearch...`, InlineCommentsService.name);
    this.fullTextSearchService.deleteDocument(ElasticSearchIndex.InlineComment, inlineComment.id);

    if (!inlineComment.parent_comment_id) {
      // Only inline comments without children
      const report_last_version: number = await this.reportsService.getLastVersionOfReport(report.id);
      const numTasks: number = await this.countInlineComments({
        filter: {
          parent_comment_id: null,
          report_id: report.id,
          report_version: report_last_version,
        },
      });
      this.fullTextSearchService.updateNumTasksInKysoIndex(report.id, numTasks);
    }

    return true;
  }

  public async inlineCommentModelToInlineCommentDtoArray(inlineComments: InlineComment[]): Promise<InlineCommentDto[]> {
    const result: InlineCommentDto[] = [];

    for (const model of inlineComments) {
      try {
        result.push(await this.inlineCommentModelToInlineCommentDto(model));
      } catch (e) {
        Logger.error('Error transforming inline comment to inline comment dto', e);
      }
    }

    return result;
  }

  public async inlineCommentModelToInlineCommentDto(inlineComment: InlineComment): Promise<InlineCommentDto> {
    try {
      const user: User = await this.usersService.getUserById(inlineComment.user_id);
      const file: File = await this.filesService.getFileById(inlineComment.file_id);

      const inlineCommentDto: InlineCommentDto = new InlineCommentDto(
        inlineComment.id,
        inlineComment.created_at,
        inlineComment.updated_at,
        inlineComment.report_id,
        inlineComment.file_id,
        file && file.path_scs ? file.path_scs : '',
        inlineComment.cell_id,
        inlineComment.user_id,
        inlineComment.text,
        inlineComment.edited,
        inlineComment.markedAsDeleted,
        user && user.name ? user.name : 'Unknown user',
        user && user.avatar_url ? user.avatar_url : '',
        inlineComment.mentions,
        inlineComment.parent_comment_id,
        inlineComment.report_version,
        inlineComment.current_status,
        inlineComment.orphan,
      );

      inlineCommentDto.status_history = inlineComment.status_history;

      if (!inlineComment.parent_comment_id) {
        try {
          const inlineComments: InlineComment[] = await this.provider.read({ filter: { parent_comment_id: inlineComment.id }, sort: { created_at: 1 } });
          inlineCommentDto.inline_comments = await Promise.all(inlineComments.map((ic: InlineComment) => this.inlineCommentModelToInlineCommentDto(ic)));
        } catch (ex) {
          Logger.warn(`Error processing child inline comments`, ex);
        }
      }

      return inlineCommentDto;
    } catch (ex) {
      Logger.error(`Error converting inlineComment ${inlineComment.id} to inlineCommentDTO`, ex);
      return new InlineCommentDto(
        inlineComment.id,
        inlineComment.created_at,
        inlineComment.updated_at,
        inlineComment.report_id,
        inlineComment.file_id,
        '',
        inlineComment.cell_id,
        inlineComment.user_id,
        inlineComment.text,
        inlineComment.edited,
        inlineComment.markedAsDeleted,
        '',
        '',
        inlineComment.mentions,
        inlineComment.parent_comment_id,
        inlineComment.report_version,
        inlineComment.current_status,
        inlineComment.orphan,
      );
    }
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

    // START: UPDATE STATUS HISTORY AND COPY COMMENTS TO NEW VERSION
    for (const file_previous_version of files_previous_version) {
      const file_current_version: File | undefined = files_current_version.find((file: File) => file.name === file_previous_version.name);
      if (!file_current_version) {
        // File was deleted in current version
        continue;
      }
      const inline_comments_previous_version: InlineComment[] = await this.provider.read({
        filter: {
          report_id,
          file_id: file_previous_version.id,
          report_version: file_previous_version.version,
          parent_comment_id: null,
          current_status: {
            $ne: InlineCommentStatusEnum.CLOSED,
          },
        },
      });

      for (const inline_comment_previous_version of inline_comments_previous_version) {
        if (!inline_comment_previous_version.orphan) {
          let inline_comment_current_version: InlineComment = new InlineComment(
            report_id,
            file_current_version.id,
            file_previous_version.id === inline_comment_previous_version.cell_id ? file_current_version.id : inline_comment_previous_version.cell_id,
            inline_comment_previous_version.user_id,
            inline_comment_previous_version.text,
            inline_comment_previous_version.edited,
            inline_comment_previous_version.markedAsDeleted,
            inline_comment_previous_version.mentions,
            null,
            report_version,
            inline_comment_previous_version.current_status,
            inline_comment_previous_version.orphan,
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
              file_current_version.id,
              file_previous_version.id === inline_comment_reply_previous_version.cell_id ? file_current_version.id : inline_comment_reply_previous_version.cell_id,
              inline_comment_reply_previous_version.user_id,
              inline_comment_reply_previous_version.text,
              inline_comment_reply_previous_version.edited,
              inline_comment_reply_previous_version.markedAsDeleted,
              inline_comment_reply_previous_version.mentions,
              inline_comment_current_version.id,
              report_version,
              inline_comment_reply_previous_version.current_status,
              inline_comment_reply_previous_version.orphan,
            );
            inline_comment_reply_current_version = await this.provider.create(inline_comment_reply_current_version);
          }
        } else {
          // If the comment is orphan, don't propagate it to newer versions
        }
      }
    }
    // END: UPDATE STATUS HISTORY AND COPY COMMENTS TO NEW VERSION

    // START: REINDEX INLINE COMMENTS
    await this.reindexCommentsGivenReportId(report_id);
    // END: REINDEX INLINE COMMENTS
  }

  public async reindexInlineComments(): Promise<void> {
    await this.fullTextSearchService.deleteAllDocumentsOfType(ElasticSearchIndex.InlineComment);
    const reports: Report[] = await this.reportsService.getReports({});
    for (const report of reports) {
      await this.reindexCommentsGivenReportId(report.id);
    }
  }

  public async reindexCommentsGivenReportId(report_id: string): Promise<void> {
    const report: Report | null = await this.reportsService.getReport(report_id);
    if (!report) {
      Logger.warn(`Report ${report_id} not found`, InlineCommentsService.name);
      return;
    }
    const team: Team | null = await this.teamsService.getTeam(report.team_id);
    if (!team) {
      Logger.warn(`Team ${report.team_id} not found for report ${report.id}`, InlineCommentsService.name);
      return;
    }
    const organization: Organization | null = await this.organizationsService.getOrganization(team.organization_id);
    if (!organization) {
      Logger.warn(`Organization ${team.organization_id} not found for team ${team.id} and report ${report.id}`, InlineCommentsService.name);
      return;
    }
    await this.fullTextSearchService.deleteDocumentsGivenTypeOrganizationAndTeam(ElasticSearchIndex.InlineComment, organization.sluglified_name, team.sluglified_name);
    const report_version: number = await this.reportsService.getLastVersionOfReport(report_id);
    const inlineComments: InlineComment[] = await this.provider.read({ filter: { report_id, report_version } });
    const promises: Promise<any>[] = [];
    for (const inlineComment of inlineComments) {
      promises.push(this.indexInlineComment(inlineComment));
    }
    await Promise.all(promises);
    Logger.log(
      `Reindexed ${inlineComments.length} inline comments for report '${report_id}' of team '${team.sluglified_name}' and organization '${organization.sluglified_name}'`,
      InlineCommentsService.name,
    );
  }

  private async indexInlineComment(inlineComment: InlineComment): Promise<any> {
    Logger.log(`Indexing inline comment '${inlineComment.id}' of user '${inlineComment.user_id}'`, InlineCommentsService.name);
    const kysoIndex: KysoIndex = await this.inlineCommentToKysoIndex(inlineComment);
    if (kysoIndex) {
      return this.fullTextSearchService.indexDocument(kysoIndex);
    } else {
      return null;
    }
  }

  private async inlineCommentToKysoIndex(inlineComment: InlineComment): Promise<KysoIndex> {
    const kysoIndex: KysoIndex = new KysoIndex();
    kysoIndex.title = inlineComment.text;
    kysoIndex.content = inlineComment.text;
    kysoIndex.type = ElasticSearchIndex.InlineComment;
    kysoIndex.entityId = inlineComment.id;
    kysoIndex.updatedAt = moment(inlineComment.updated_at).unix() * 1000;
    kysoIndex.version = inlineComment.report_version;

    const report: Report = await this.reportsService.getReportById(inlineComment.report_id);
    if (!report) {
      Logger.error(`Report ${inlineComment.report_id} could not be found`, InlineCommentsService.name);
      return null;
    }
    const file: File | null = await this.filesService.getFileById(inlineComment.file_id);
    if (!file) {
      Logger.error(`File ${inlineComment.file_id} could not be found for inline comment ${inlineComment.comment_id}`, InlineCommentsService.name);
      return null;
    }
    const team: Team | null = await this.teamsService.getTeamById(report.team_id);
    if (!team) {
      Logger.error(`Team ${report.team_id} could not be found for inline comment ${inlineComment.comment_id}`, InlineCommentsService.name);
      return null;
    }
    const organization: Organization | null = await this.organizationsService.getOrganizationById(team.organization_id);
    if (!organization) {
      Logger.error(`Organization ${team.organization_id} could not be found for team ${team.id} and inline comment ${inlineComment.comment_id}`, InlineCommentsService.name);
      return null;
    }

    kysoIndex.link = `/${organization.sluglified_name}/${team.sluglified_name}/${report.sluglified_name}/${file.name}`;
    kysoIndex.organizationSlug = organization?.sluglified_name ? organization.sluglified_name : '';
    kysoIndex.teamSlug = team?.sluglified_name ? team.sluglified_name : '';

    const user: User | null = await this.usersService.getUserById(inlineComment.user_id);
    if (user) {
      kysoIndex.people.push(user.email);
    }
    if (inlineComment?.user_ids && inlineComment.user_ids.length > 0) {
      for (const userId of inlineComment.user_ids) {
        const user: User | null = await this.usersService.getUserById(userId);
        if (user) {
          const index: number = kysoIndex.people.indexOf(user.email);
          if (index === -1) {
            kysoIndex.people.push(user.email);
          }
        }
      }
    }

    return kysoIndex;
  }
}
