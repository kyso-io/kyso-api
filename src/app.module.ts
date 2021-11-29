import { Module } from '@nestjs/common'
import { CommentsModule } from './modules/comments/comments.module'
import { ConfigModule } from '@nestjs/config'
import { ReportsModule } from './modules/reports/reports.module'
import { TeamsModule } from './modules/teams/teams.module'
import { UsersModule } from './modules/users/users.module'
import { GithubReposModule } from './modules/github-repos/github-repos.module'
import { BitbucketReposModule } from './modules/bitbucket-repos/bitbucket-repos.module'
import { AuthModule } from './modules/auth/auth.module'
@Module({
    imports: [
        ConfigModule.forRoot(), // This loads .env file
        BitbucketReposModule,
        CommentsModule,
        GithubReposModule,
        ReportsModule,
        TeamsModule,
        UsersModule,
        AuthModule,
    ],
    controllers: [],
})
export class AppModule {}
