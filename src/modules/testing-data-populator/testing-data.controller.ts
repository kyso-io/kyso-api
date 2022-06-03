import { Controller, Get, Res } from '@nestjs/common'
import { TestingDataPopulatorService } from './testing-data-populator.service'

@Controller('testing-data')
export class TestingDataController {
    constructor(private readonly testingDataPopulatorService: TestingDataPopulatorService) {}

    @Get('/populated')
    public async getPopulatedData(@Res() res): Promise<void> {
        const result: boolean = await this.testingDataPopulatorService.checkIfAlreadyExists()
        if (result) {
            res.status(200).send()
        } else {
            res.status(404).send()
        }
    }
}
