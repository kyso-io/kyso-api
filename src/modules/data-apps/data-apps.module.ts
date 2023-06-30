import { Module } from '@nestjs/common';
import { DataAppsService } from './data-apps.service';

@Module({
  controllers: [],
  providers: [DataAppsService],
})
export class DataAppsModule {}
