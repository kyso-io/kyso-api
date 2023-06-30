import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { GenericExceptionFilter } from './filters/generic-exception.filter';
import { RequestLoggerMiddleware } from './middleware/request-logger.middleware';
import { ActivityFeedModule } from './modules/activity-feed/activity-feed.module';
import { AuthModule } from './modules/auth/auth.module';
import { BitbucketReposModule } from './modules/bitbucket-repos/bitbucket-repos.module';
import { CommentsModule } from './modules/comments/comments.module';
import { DataAppsModule } from './modules/data-apps/data-apps.module';
import { DiscussionsModule } from './modules/discussions/discussions.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { FullTextSearchModule } from './modules/full-text-search/full-text-search.module';
import { GithubReposModule } from './modules/github-repos/github-repos.module';
import { GitlabReposModule } from './modules/gitlab-repos/gitlab-repos.module';
import { InlineCommentsModule } from './modules/inline-comments/inline-comments.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { KysoSettingsModule } from './modules/kyso-settings/kyso-settings.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { RelationsModule } from './modules/relations/relations.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RequestAccessModule } from './modules/request-access/request-access.module';
import { SearchUserModule } from './modules/search-user/search-user.module';
import { TagsModule } from './modules/tags/tags.module';
import { TeamsModule } from './modules/teams/teams.module';
import { TestingDataPopulatorModule } from './modules/testing-data-populator/testing-data-populator.module';
import { ThemesModule } from './modules/themes/themes.module';
import { UsersNotificationsSettingsModule } from './modules/user-notifications-settings/users-notifications-settings.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ActivityFeedModule.forRoot(),
    AuthModule.forRoot(),
    BitbucketReposModule.forRoot(),
    CommentsModule.forRoot(),
    DataAppsModule,
    DiscussionsModule.forRoot(),
    FeedbackModule,
    FullTextSearchModule.forRoot(),
    GithubReposModule.forRoot(),
    GitlabReposModule.forRoot(),
    KysoSettingsModule.forRoot(),
    InlineCommentsModule.forRoot(),
    InvitationsModule.forRoot(),
    OrganizationsModule.forRoot(),
    PrometheusModule.register(),
    RelationsModule.forRoot(),
    ReportsModule.forRoot(),
    RequestAccessModule.forRoot(),
    SearchUserModule.forRoot(),
    TagsModule.forRoot(),
    TeamsModule.forRoot(),
    TestingDataPopulatorModule,
    ThemesModule,
    UsersModule.forRoot(),
    UsersNotificationsSettingsModule.forRoot(),
  ],
  providers: [
    RequestLoggerMiddleware,
    {
      provide: APP_FILTER,
      useClass: GenericExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
