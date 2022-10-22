import { DynamicModule } from '@nestjs/common';
import { createProvider, RelationsService } from './relations.service';
import { RelationsMongoProvider } from './providers/mongo-relations.provider';

/*@Module({
    providers: [RelationsService, RelationsMongoProvider],
    exports: [RelationsService],
})*/
export class RelationsModule {
  static forRoot(): DynamicModule {
    const dynamicProvider = createProvider();

    return {
      module: RelationsModule,
      providers: [RelationsService, RelationsMongoProvider, dynamicProvider],
      exports: [dynamicProvider],
    };
  }
}
