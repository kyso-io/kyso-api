import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthService } from './modules/auth/auth.service'
import { GithubLoginProvider } from './modules/auth/providers/github-login.provider'
import { KysoLoginProvider } from './modules/auth/providers/kyso-login.provider'
import { PlatformRoleMongoProvider } from './modules/auth/providers/mongo-platform-role.provider'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './modules/auth/auth.controller'
import { BitbucketReposController } from './modules/bitbucket-repos/bitbucket-repos.controller'
import { BitbucketReposService } from './modules/bitbucket-repos/bitbucket-repos.service'
import { BitbucketReposProvider } from './modules/bitbucket-repos/providers/bitbucket-repo.provider'
import { CommentsService } from './modules/comments/comments.service'
import { CommentsMongoProvider } from './modules/comments/providers/mongo-comments.provider'
import { CommentsController } from './modules/comments/comments.controller'
import { GithubReposController } from './modules/github-repos/github-repos.controller'
import { GithubReposService } from './modules/github-repos/github-repos.service'
import { GithubReposProvider } from './modules/github-repos/providers/github-repo.provider'
import { OrganizationsController } from './modules/organizations/organizations.controller'
import { OrganizationsService } from './modules/organizations/organizations.service'
import { OrganizationMemberMongoProvider } from './modules/organizations/providers/mongo-organization-member.provider'
import { OrganizationsMongoProvider } from './modules/organizations/providers/mongo-organizations.provider'
import { LocalReportsService } from './modules/reports/local-reports.service'
import { FilesMongoProvider } from './modules/reports/providers/mongo-files.provider'
import { ReportsMongoProvider } from './modules/reports/providers/mongo-reports.provider'
import { VersionsMongoProvider } from './modules/reports/providers/mongo-versions.provider'
import { FilesS3Provider } from './modules/reports/providers/s3-files.provider'
import { ReportsService } from './modules/reports/reports.service'
import { ReportsController } from './modules/reports/reports.controller'
import { TeamMemberMongoProvider } from './modules/teams/providers/mongo-team-member.provider'
import { TeamsMongoProvider } from './modules/teams/providers/mongo-teams.provider'
import { TeamsService } from './modules/teams/teams.service'
import { TeamsController } from './modules/teams/teams.controller'
import { UsersMongoProvider } from './modules/users/providers/mongo-users.provider'
import { UsersService } from './modules/users/users.service'
import { UsersController } from './modules/users/users.controller'
import { UserController } from './modules/users/user.controller'

@Module({
    imports: [
        ConfigModule.forRoot(), // This loads .env file
        JwtModule.register({
            secret: 'OHMYGODTHISISASECRET',
        })
    ],
    providers: [
        // auth
        AuthService, 
        KysoLoginProvider, 
        GithubLoginProvider, 
        PlatformRoleMongoProvider,
        // bitbucket-repos
        BitbucketReposService, 
        BitbucketReposProvider,
        // comments
        CommentsService, 
        CommentsMongoProvider,
        // github-repos
        GithubReposService, 
        GithubReposProvider,
        // organizations
        OrganizationsService, 
        OrganizationsMongoProvider, 
        OrganizationMemberMongoProvider,
        // reports
        FilesMongoProvider, 
        ReportsMongoProvider, 
        VersionsMongoProvider, 
        FilesS3Provider, 
        ReportsService, 
        LocalReportsService,
        // teams
        TeamsService, 
        TeamsMongoProvider, 
        TeamMemberMongoProvider,
        // users
        UsersService, 
        UsersMongoProvider
    ],
    controllers: [
        AuthController,
        BitbucketReposController,
        CommentsController,
        GithubReposController,
        OrganizationsController,
        ReportsController,
        TeamsController,
        UsersController,
        UserController
    ],
})
export class AppModule {}
