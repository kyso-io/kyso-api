import { Controller, Get, Next, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import * as feedback from './providers/email/feedback';
import * as salesRequest from './providers/email/sales-request';
const pkg = require('../../../package')

// general
// const salesRequest = require('./providers/email/sales-request.js')

@ApiTags('/')
@Controller('/')
export class LegacyController {
    constructor() {
    }

    @Get("/test-hash/:password")
    @ApiOperation({
        summary: `Test`
    })
    @ApiResponse({ status: 200, description: `Hashed password`, type: String})
    testHashPassword(@Param('password') password: string) {
        return bcrypt.hashSync(password, 10);
    }

    @Get("/test-hash/compare/:password/:hashedPassword")
    @ApiOperation({
        summary: `Test`
    })
    @ApiResponse({ status: 200, description: `Hashed password`, type: String})
    testCompareHashPassword(@Param('password') password: string,
        @Param('hashedPassword') hashedPassword: string) {
        return bcrypt.compare(password, hashedPassword);
    }

    @Get()
    @ApiOperation({
        summary: `Returns Kyso Version info`
    })
    @ApiResponse({ status: 200, description: `Version of the API`, type: String})
    getRoot() {
        
        return `Kyso version ${pkg.version}`
    }

    @Get('/version')
    @ApiOperation({
        summary: `Returns Kyso Version info`
    })
    @ApiResponse({ status: 200,  description: `Version of the API`, type: String})
    getVersion() {
        return `Kyso version ${pkg.version}`
    }

    /*
    api.post(`/feedback`, bodyParser.json(), badRequestOnFailure(requireUser), feedback.handler)
    */
    @Post('/feedback')
    @ApiOperation({
        summary: ``
    })
    postFeedback(@Req() req, @Res() res, @Next() next) {
        return feedback.handler(req, res, next)
    }

    // api.post(`/sales-request`, bodyParser.json(), salesRequest.handler)
    @Post('/sales-request')
    @ApiOperation({
        summary: ``
    })
    postSalesRequest(@Req() req, @Res() res, @Next() next) {
        return salesRequest.handler(req, res, next)
    }
}
