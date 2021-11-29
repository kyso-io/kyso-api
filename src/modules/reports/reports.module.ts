import { Module } from '@nestjs/common'
import { CommentsModule } from '../comments/comments.module'
import { GithubReposModule } from '../github-repos/github-repos.module'
import { TeamsModule } from '../teams/teams.module'
import { UsersModule } from '../users/users.module'
import { LocalReportsService } from './local-reports.service'
import { FilesMongoProvider } from './providers/mongo-files.provider'
import { ReportsMongoProvider } from './providers/mongo-reports.provider'
import { VersionsMongoProvider } from './providers/mongo-versions.provider'
import { FilesS3Provider } from './providers/s3-files.provider'
import { ReportsController } from './reports.controller'
import { ReportsService } from './reports.service'

@Module({
    imports: [UsersModule, TeamsModule, CommentsModule, GithubReposModule],
    providers: [
        FilesMongoProvider,
        ReportsMongoProvider,
        VersionsMongoProvider,
        FilesS3Provider,
        ReportsService,
        LocalReportsService,
    ],
    controllers: [ReportsController],
    exports: [ReportsService, LocalReportsService],
})
export class ReportsModule {}
