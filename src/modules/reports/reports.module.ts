import { Module } from '@nestjs/common'
import { CommentsModule } from '../comments/comments.module'
import { GithubReposModule } from '../github-repos/github-repos.module'
import { TeamsModule } from '../teams/teams.module'
import { LocalReportsService } from './local-reports.service'
import { FilesMongoProvider } from './providers/mongo-files.provider'
import { ReportsMongoProvider } from './providers/mongo-reports.provider'
import { RelationsModule } from '../relations/relations.module'
import { VersionsMongoProvider } from './providers/mongo-versions.provider'
import { FilesS3Provider } from './providers/s3-files.provider'
import { ReportsController } from './reports.controller'
import { ReportsService } from './reports.service'

@Module({
    imports: [GithubReposModule, TeamsModule, CommentsModule, RelationsModule],
    providers: [ReportsService, LocalReportsService, ReportsMongoProvider, FilesMongoProvider, VersionsMongoProvider, FilesS3Provider],
    controllers: [ReportsController],
    exports: [ReportsService, LocalReportsService],
})
export class ReportsModule {}
