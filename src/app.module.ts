import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from './modules/auth/auth.module'
import { BitbucketReposModule } from './modules/bitbucket-repos/bitbucket-repos.module'
import { CommentsModule } from './modules/comments/comments.module'
import { GithubReposModule } from './modules/github-repos/github-repos.module'
import { OrganizationsModule } from './modules/organizations/organizations.module'
import { ReportsModule } from './modules/reports/reports.module'
import { TeamsModule } from './modules/teams/teams.module'
import { TestingDataPopulatorModule } from './modules/testing-data-populator/testing-data-populator.module'
import { UsersModule } from './modules/users/users.module'

@Module({
    imports: [
        UsersModule,
        AuthModule,
        BitbucketReposModule,
        CommentsModule,
        GithubReposModule,
        OrganizationsModule,
        ReportsModule,
        TeamsModule,
        TestingDataPopulatorModule,
    ],
})
export class AppModule {}
