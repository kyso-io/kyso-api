import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, Logger } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from './../src/app.module'

describe('AppController (e2e)', () => {
    let app: INestApplication

    beforeEach(async () => {
        expect(process.env.NODE_ENV).toBeDefined()
        expect(process.env.NODE_ENV).toBe("testing")
        
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                AppModule
            ],
        })
        .compile()

        expect(process.env.DATABASE_URI).toBeDefined()
        
        
        app = moduleFixture.createNestApplication()
        await app.init()
    })

    it('/ (GET)', () => {
        return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!')
    })
})