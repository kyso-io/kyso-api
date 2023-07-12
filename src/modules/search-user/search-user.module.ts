import { DynamicModule } from '@nestjs/common';
import { SearchUserMongoProvider } from './search-user.provider';

export class SearchUserModule {
  static forRoot(): DynamicModule {
    return {
      // controllers: [SearchUserController],
      module: SearchUserModule,
      providers: [SearchUserMongoProvider],
    };
  }
}
