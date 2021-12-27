import { Module, OnModuleInit } from '@nestjs/common'
import { OrganizationsModule } from '../organizations/organizations.module'
import { ReportsModule } from '../reports/reports.module'
import { TeamsModule } from '../teams/teams.module'
import { UsersModule } from '../users/users.module'
import { TestingDataPopulatorService } from './testing-data-populator.service'

/**
 * Introduces testing data in the database if POPULATE_TEST_DATA exists and is set to true
 */
@Module({
    imports: [UsersModule, OrganizationsModule, TeamsModule, ReportsModule],
    providers: [TestingDataPopulatorService],
    controllers: [],
    exports: [],
})
export class TestingDataPopulatorModule implements OnModuleInit {
    constructor(private readonly testingDataPopulatorService: TestingDataPopulatorService) {}

    async onModuleInit() {
        if (process.env.POPULATE_TEST_DATA === 'true') {
            await this.testingDataPopulatorService.populateTestData()
        }
    }
}
