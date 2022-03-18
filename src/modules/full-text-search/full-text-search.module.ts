import { Module } from '@nestjs/common'
import { FullTextSearchController } from './full-text-search.controller';


@Module({
    providers: [],
    controllers: [FullTextSearchController],
    exports: [],
})
export class FullTextSearchModule {
}
