import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, Logger } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from './../src/app.module'
jest.useFakeTimers()

describe('AppController (e2e)', () => {
    let app: INestApplication

    beforeAll(async() => {
        jest.useFakeTimers()
        expect(process.env.NODE_ENV).toBeDefined()
        expect(process.env.NODE_ENV).toBe("testing")
        
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                AppModule
            ],
        })
        .compile()
        
        app = moduleFixture.createNestApplication()
        await app.init()
    })

    it("test", () => {
        Logger.log("kakalavaca")
    })
})