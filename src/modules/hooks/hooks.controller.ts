import { Body, Controller, Post } from '@nestjs/common'
import { HooksService } from './hooks.service'

@Controller('hooks')
export class HooksController {
    constructor(private readonly hooksService: HooksService) {}

    @Post('github')
    public async githubHook(@Body() body: any): Promise<void> {
        console.log(body)
    }
}
