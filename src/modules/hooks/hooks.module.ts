import { Module } from '@nestjs/common'
import { HooksController } from './hooks.controller'
import { HooksService } from './hooks.service'

@Module({
    controllers: [HooksController],
    providers: [HooksService],
})
export class HooksModule {}
