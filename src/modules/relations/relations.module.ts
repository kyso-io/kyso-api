import { Module } from '@nestjs/common'
import { RelationsService } from './relations.service'
import { RelationsMongoProvider } from './providers/mongo-relations.provider'

@Module({
    providers: [RelationsService, RelationsMongoProvider],
    exports: [RelationsService],
})
export class RelationsModule {}
