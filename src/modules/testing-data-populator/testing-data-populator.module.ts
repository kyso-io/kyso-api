import { Module } from '@nestjs/common'
import { TestingDataPopulatorService } from './testing-data-populator.service'

/**
 * Introduces testing data in the database if POPULATE_TEST_DATA exists and is set to true
 */
@Module({
    providers: [TestingDataPopulatorService],
    controllers: [],
    exports: [],
})
export class TestingDataPopulatorModule {}
