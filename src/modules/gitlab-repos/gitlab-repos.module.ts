import { DynamicModule } from '@nestjs/common';
import { createProvider, GitlabReposService } from './gitlab-repos.service';
import { GitlabReposProvider } from './providers/gitlab-repos.provider';

export class GitlabReposModule {
  static forRoot(): DynamicModule {
    const dynamicProvider = createProvider();

    return {
      module: GitlabReposModule,
      providers: [GitlabReposService, dynamicProvider, GitlabReposProvider],
      // controllers: [GitlabReposController],
      exports: [dynamicProvider],
    };
  }
}
