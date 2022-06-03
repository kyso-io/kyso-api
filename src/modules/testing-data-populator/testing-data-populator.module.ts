import { Module } from '@nestjs/common'
import { TestingDataPopulatorService } from './testing-data-populator.service'
import { TestingDataController } from './testing-data.controller'

/**
 * Introduces testing data in the database if POPULATE_TEST_DATA exists and is set to true
 */
@Module({
    providers: [TestingDataPopulatorService],
    controllers: [TestingDataController],
    exports: [],
})
export class TestingDataPopulatorModule {}
