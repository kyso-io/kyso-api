import { Module } from '@nestjs/common';
import { LegacyController } from './legacy.controller';
import { LegacyService } from './legacy.service';

@Module({
  providers: [ 
    LegacyService
  ],
  controllers: [LegacyController],
  exports: [ LegacyService ]
})
export class LegacyModule {

}
