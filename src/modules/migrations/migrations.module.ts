import { Module } from '@nestjs/common'
import { HooksController } from './migrations.controller'

@Module({
    providers: [HooksController],
})
export class HooksModule {}
