import { DynamicModule } from '@nestjs/common';
import { FullTextSearchController } from './full-text-search.controller';
import { createProvider, FullTextSearchService } from './full-text-search.service';

export class FullTextSearchModule {
  static forRoot(): DynamicModule {
    const fullTextSearchProvider = createProvider();

    return {
      module: FullTextSearchModule,
      providers: [FullTextSearchService, fullTextSearchProvider],
      controllers: [FullTextSearchController],
      exports: [fullTextSearchProvider],
    };
  }
}
