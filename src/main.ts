import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import * as helmet from 'helmet'
import * as fs from 'fs'
import { RedocOptions, RedocModule } from 'nestjs-redoc'
import { Logger } from '@nestjs/common'

const { MongoClient, ObjectId } = require('mongodb')
export let client
export let db

async function bootstrap() {
    await connectToDatabase(process.env.DATABASE_NAME || 'kyso-initial')
    const app = await NestFactory.create(AppModule)

    const globalPrefix = 'v1'
    // Helmet can help protect an app from some well-known web vulnerabilities by setting HTTP headers appropriately
    app.use(helmet())
    app.setGlobalPrefix(globalPrefix)

    // bindSwaggerDocument(globalPrefix, app);

    const config = new DocumentBuilder()
        .setTitle(`Kyso's API`)
        .setDescription(`Spec for Kyso's API`)
        .setVersion('v1')
        .addBearerAuth()
        .setLicense('Apache 2.0', 'http://www.apache.org/licenses/LICENSE-2.0.html')
        .build()

    const document = SwaggerModule.createDocument(app, config)

    // ITERATE SEARCHING FOR "faker: " AND MODIFY HERE

    // TODO: Only publish in development / staging mode, remove for production - or discuss it...
    SwaggerModule.setup(globalPrefix, app, document)

    const redocOptions: RedocOptions = {
        title: 'Kyso API',
        favicon: 'https://kyso.io/static/images/white-logo.svg',
        logo: {
            url: 'https://raw.githubusercontent.com/kyso-io/brand/master/kyso-white.svg',
            backgroundColor: '#002A60',
            altText: 'Kyso.io logo',
        },
        sortPropsAlphabetically: true,
        hideDownloadButton: false,
        hideHostname: false,
    }

    let redocDocument = Object.assign({}, document)

    // Only for redocs, add general documentation data (tags)
    redocDocument.tags = [
        {
            name: 'Filtering',
            description: fs.readFileSync('./src/openapi/filtering.md', 'utf8'),
        },
        {
            name: 'Projection',
            description: fs.readFileSync('./src/openapi/projection.md', 'utf8'),
        },
        {
            name: 'Sorting',
            description: fs.readFileSync('./src/openapi/sorting.md', 'utf8'),
        },
        {
            name: 'Pagination',
            description: fs.readFileSync('./src/openapi/pagination.md', 'utf8'),
        },
    ]

    await RedocModule.setup('/redoc', app, redocDocument, redocOptions)

    await app.listen(process.env.PORT || 3000)
}

async function connectToDatabase(DB_NAME) {
    Logger.log(`Connecting to database...`)
    if (!client) {
        try {
            client = await MongoClient.connect(process.env.DATABASE_URI, {
                useUnifiedTopology: true,
                maxPoolSize: 10,
                // poolSize: 10 <-- Deprecated
            })
            db = client.db(DB_NAME)
            await db.command({ ping: 1 })
        } catch (err) {
            Logger.error(`Couldn't connect with mongoDB instance at ${process.env.DATABASE_URI}`)
            Logger.error(err)
            process.exit()
        }
    }
}

bootstrap()
