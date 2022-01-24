import { DynamicModule } from '@nestjs/common'
import { GithubReposController } from './github-repos.controller'
import { createProvider, GithubReposService } from './github-repos.service'
import { GithubReposProvider } from './providers/github-repo.provider'

export class GithubReposModule {
    static forRoot(): DynamicModule {
        const dynamicProvider = createProvider()

        return {
            module: GithubReposModule,
            providers: [GithubReposService, GithubReposProvider, dynamicProvider],
            controllers: [GithubReposController],
            exports: [dynamicProvider],
        }
    }
}
