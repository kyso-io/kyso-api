import { Module } from '@nestjs/common'
import { HooksController } from './hooks.controller'

@Module({
    controllers: [HooksController],
})
export class HooksModule {}
