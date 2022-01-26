import { MailerModule } from '@nestjs-modules/mailer'
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter'
import { Module } from '@nestjs/common'
import { join } from 'path'
import { AuthModule } from './modules/auth/auth.module'
import { BitbucketReposModule } from './modules/bitbucket-repos/bitbucket-repos.module'
import { CommentsModule } from './modules/comments/comments.module'
import { DiscussionsModule } from './modules/discussions/discussions.module'
import { GithubReposModule } from './modules/github-repos/github-repos.module'
import { HooksModule } from './modules/hooks/hooks.module'
import { OrganizationsModule } from './modules/organizations/organizations.module'
import { RelationsModule } from './modules/relations/relations.module'
import { ReportsModule } from './modules/reports/reports.module'
import { TagsModule } from './modules/tags/tags.module'
import { TeamsModule } from './modules/teams/teams.module'
import { TestingDataPopulatorModule } from './modules/testing-data-populator/testing-data-populator.module'
import { UsersModule } from './modules/users/users.module'

@Module({
    imports: [
        AuthModule.forRoot(),
        BitbucketReposModule.forRoot(),
        CommentsModule.forRoot(),
        DiscussionsModule.forRoot(),
        GithubReposModule.forRoot(),
        HooksModule,
        MailerModule.forRootAsync({
            useFactory: () => {
                return {
                    transport: process.env.MAIL_TRANSPORT,
                    defaults: {
                        from: process.env.MAIL_FROM,
                    },
                    template: {
                        dir: join(__dirname, '../../templates'),
                        adapter: new HandlebarsAdapter(),
                        options: {
                            strict: true,
                        },
                    },
                }
            },
        }),
        OrganizationsModule.forRoot(),
        RelationsModule.forRoot(),
        ReportsModule.forRoot(),
        TagsModule.forRoot(),
        TeamsModule.forRoot(),
        TestingDataPopulatorModule,
        UsersModule.forRoot(),
    ],
})
export class AppModule {}
