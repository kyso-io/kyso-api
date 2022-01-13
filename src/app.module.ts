import { MailerModule } from '@nestjs-modules/mailer'
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter'
import { Module } from '@nestjs/common'
import { join } from 'path'
import { AuthModule } from './modules/auth/auth.module'
import { BitbucketReposModule } from './modules/bitbucket-repos/bitbucket-repos.module'
import { CommentsModule } from './modules/comments/comments.module'
import { GithubReposModule } from './modules/github-repos/github-repos.module'
import { OrganizationsModule } from './modules/organizations/organizations.module'
import { RelationsModule } from './modules/relations/relations.module'
import { ReportsModule } from './modules/reports/reports.module'
import { TeamsModule } from './modules/teams/teams.module'
import { TestingDataPopulatorModule } from './modules/testing-data-populator/testing-data-populator.module'
import { UsersModule } from './modules/users/users.module'

@Module({
    imports: [
        UsersModule.forRoot(),
        AuthModule.forRoot(),
        BitbucketReposModule.forRoot(),
        CommentsModule.forRoot(),
        GithubReposModule.forRoot(),
        OrganizationsModule.forRoot(),
        ReportsModule.forRoot(),
        TeamsModule.forRoot(),
        RelationsModule.forRoot(),
        TestingDataPopulatorModule,
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
    ],
})
export class AppModule {}
