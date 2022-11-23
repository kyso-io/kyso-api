import { Module } from '@nestjs/common';
import { NestjsFormDataModule } from 'nestjs-form-data';
import { ThemesController } from './themes.controller';
import { ThemesService } from './themes.service';

@Module({
  controllers: [ThemesController],
  imports: [NestjsFormDataModule],
  providers: [ThemesService],
})
export class ThemesModule {}
