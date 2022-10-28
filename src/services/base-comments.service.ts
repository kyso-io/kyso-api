import {
  Discussion,
  KysoCommentsCreateEvent,
  KysoCommentsDeleteEvent,
  KysoCommentsUpdateEvent,
  KysoEventEnum,
  KysoReportsMentionsEvent,
  KysoReportsNewMentionEvent,
  KysoSettingsEnum,
  Organization,
  Report,
  Team,
  User,
} from '@kyso-io/kyso-model';
import { BaseComment } from '@kyso-io/kyso-model/dist/models/base-comment.model';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Autowired } from 'src/decorators/autowired';
import { AutowiredService } from 'src/generic/autowired.generic';
import { NATSHelper } from 'src/helpers/natsHelper';
import { CommentsService } from 'src/modules/comments/comments.service';
import { KysoSettingsService } from 'src/modules/kyso-settings/kyso-settings.service';
import { OrganizationsService } from 'src/modules/organizations/organizations.service';
import { ReportsService } from 'src/modules/reports/reports.service';
import { TeamsService } from 'src/modules/teams/teams.service';
import { UsersService } from 'src/modules/users/users.service';

@Injectable()
export class BaseCommentsService extends AutowiredService {
  @Autowired({ typeName: 'UsersService' })
  private usersService: UsersService;

  @Autowired({ typeName: 'TeamsService' })
  private teamsService: TeamsService;

  @Autowired({ typeName: 'OrganizationsService' })
  private organizationsService: OrganizationsService;

  @Autowired({ typeName: 'ReportsService' })
  private reportsService: ReportsService;

  @Autowired({ typeName: 'KysoSettingsService' })
  private kysoSettingsService: KysoSettingsService;

  constructor(@Inject('NATS_SERVICE') private client: ClientProxy) {
    super();
  }

  public async sendDeleteCommentNotifications(user: User, organization: Organization, team: Team | null, comment: BaseComment, report: Report, discussion: Discussion | null): Promise<void> {
    NATSHelper.safelyEmit<KysoCommentsDeleteEvent>(this.client, KysoEventEnum.COMMENTS_DELETE, {
      user,
      organization,
      team,
      comment,
      discussion,
      report,
      frontendUrl: await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL),
    });
  }

  public async sendUpdateCommentNotifications(user: User, organization: Organization, team: Team | null, comment: BaseComment, report: Report, discussion: Discussion | null): Promise<void> {
    NATSHelper.safelyEmit<KysoCommentsUpdateEvent>(this.client, KysoEventEnum.COMMENTS_UPDATE, {
      user,
      organization,
      team,
      comment,
      discussion,
      report,
      frontendUrl: await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL),
    });
  }

  public async sendCreateCommentNotifications(user: User, organization: Organization, team: Team | null, comment: BaseComment, report: Report, discussion: Discussion | null): Promise<void> {
    if (comment?.comment_id) {
      Logger.log(`Sending ${KysoEventEnum.COMMENTS_REPLY} event to NATS`);

      NATSHelper.safelyEmit<KysoCommentsCreateEvent>(this.client, KysoEventEnum.COMMENTS_REPLY, {
        user,
        organization,
        team,
        comment,
        discussion,
        report,
        frontendUrl: await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL),
      });
    } else {
      Logger.log(`Sending ${KysoEventEnum.COMMENTS_CREATE} event to NATS`);
      NATSHelper.safelyEmit<KysoCommentsCreateEvent>(this.client, KysoEventEnum.COMMENTS_CREATE, {
        user,
        organization,
        team,
        comment,
        discussion,
        report,
        frontendUrl: await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL),
      });
    }
  }

  public async checkMentionsInReportComment(reportId: string, commentAuthorId: string, mentionedUserIds: string[]): Promise<void> {
    const report: Report = await this.reportsService.getReportById(reportId);
    const team: Team = await this.teamsService.getTeamById(report.team_id);
    const organization: Organization = await this.organizationsService.getOrganizationById(team.organization_id);
    const frontendUrl = await this.kysoSettingsService.getValue(KysoSettingsEnum.FRONTEND_URL);
    const creator: User = await this.usersService.getUserById(commentAuthorId);
    const mentionedUsers: User[] = [];
    const centralizedMails: boolean = organization?.options?.notifications?.centralized || false;
    // Remove the creator of the message from the users to notify
    const indexCreator: number = mentionedUserIds.findIndex((userId: string) => userId === creator.id);
    if (indexCreator !== -1) {
      mentionedUserIds.splice(indexCreator, 1);
    }
    for (const userId of mentionedUserIds) {
      const user: User = await this.usersService.getUserById(userId);
      if (!user) {
        Logger.error(`Could not find user with id ${userId}`, CommentsService.name);
        continue;
      }
      mentionedUsers.push(user);
      if (centralizedMails) {
        continue;
      }
      NATSHelper.safelyEmit<KysoReportsNewMentionEvent>(this.client, KysoEventEnum.REPORTS_NEW_MENTION, {
        user,
        creator,
        organization,
        team,
        report,
        frontendUrl,
      });
    }
    if (centralizedMails && organization.options.notifications.emails.length > 0 && mentionedUsers.length > 0) {
      const emails: string[] = organization.options.notifications.emails;
      NATSHelper.safelyEmit<KysoReportsMentionsEvent>(this.client, KysoEventEnum.REPORTS_MENTIONS, {
        to: emails,
        creator,
        users: mentionedUsers,
        organization,
        team,
        report,
        frontendUrl,
      });
    }
  }
}
