import { Module } from '@nestjs/common'
import { ReportsModule } from '../reports/reports.module'
import { GithubReposController } from './github-repos.controller'
import { GithubReposService } from './github-repos.service'
import { GithubReposProvider } from './providers/github-repo.provider'

@Module({
    providers: [GithubReposService, GithubReposProvider],
    controllers: [GithubReposController],
    exports: [GithubReposService],
})
export class GithubReposModule {}
