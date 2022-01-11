import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory, Reflector } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as helmet from 'helmet'
import { MongoClient } from 'mongodb'
import { RedocModule, RedocOptions } from 'nestjs-redoc'
import { AppModule } from './app.module'
import { TransformInterceptor } from './interceptors/exclude.interceptor'
import { CommentsService } from './modules/comments/comments.service'
import { GithubReposService } from './modules/github-repos/github-repos.service'
import { OrganizationsService } from './modules/organizations/organizations.service'
import { RelationsService } from './modules/relations/relations.service'
import { LocalReportsService } from './modules/reports/local-reports.service'
import { ReportsService } from './modules/reports/reports.service'
import { TeamsService } from './modules/teams/teams.service'
import { TestingDataPopulatorService } from './modules/testing-data-populator/testing-data-populator.service'
import { UsersService } from './modules/users/users.service'
export let client
export let db

// SERVICES
export let commentsService: CommentsService
export let githubReposService: GithubReposService
export let localReportsService: LocalReportsService
export let organizationsService: OrganizationsService
export let relationsService: RelationsService
export let reportsService: ReportsService
export let teamsService: TeamsService
export let usersService: UsersService

const cspDefaults = helmet.contentSecurityPolicy.getDefaultDirectives()
delete cspDefaults['upgrade-insecure-requests']

async function bootstrap() {
    Logger.log(`Loading .env-${process.env.NODE_ENV}`)

    await dotenv.config({
        path: `.env-${process.env.NODE_ENV}`,
    })

    await connectToDatabase(process.env.DATABASE_NAME || 'kyso-initial')
    const app = await NestFactory.create(AppModule)

    const globalPrefix = 'v1'
    // Helmet can help protect an app from some well-known web vulnerabilities by setting HTTP headers appropriately
    let helmetOpts = {}
    if (process.env.NODE_ENV === 'development') {
        //https://github.com/scottie1984/swagger-ui-express/issues/237
        helmetOpts = {
            contentSecurityPolicy: { directives: cspDefaults },
        }
    }
    app.use(helmet(helmetOpts))

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
        }),
    )
    app.useGlobalInterceptors(new TransformInterceptor())
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)))

    app.setGlobalPrefix(globalPrefix)

    const config = new DocumentBuilder()
        .setTitle(`Kyso's API`)
        .setDescription(`Spec for Kyso's API`)
        .setVersion('v1')
        .addBearerAuth()
        .setLicense('Apache 2.0', 'http://www.apache.org/licenses/LICENSE-2.0.html')
        .build()

    const document = SwaggerModule.createDocument(app, config)

    if (process.env.NODE_ENV === 'development') {
        // Only publish in development / staging mode, remove for production - or discuss it...
        SwaggerModule.setup(globalPrefix, app, document)
    }

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

    const redocDocument = Object.assign({}, document)

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

    await app.listen(process.env.PORT || 4000)

    if (process.env.POPULATE_TEST_DATA === 'true') {
        setTimeout(async () => {
            const testingDataPopulatorService: TestingDataPopulatorService = app.get(TestingDataPopulatorService)
            await testingDataPopulatorService.populateTestData()
        }, 10000)
    }

    commentsService = app.get<CommentsService>(CommentsService)
    localReportsService = app.get<LocalReportsService>(LocalReportsService)
    githubReposService = app.get<GithubReposService>(GithubReposService)
    organizationsService = app.get<OrganizationsService>(OrganizationsService)
    relationsService = app.get<RelationsService>(RelationsService)
    reportsService = app.get<ReportsService>(ReportsService)
    teamsService = app.get<TeamsService>(TeamsService)
    usersService = app.get<UsersService>(UsersService)
}

async function connectToDatabase(DB_NAME) {
    Logger.log(`Connecting to database... ${DB_NAME}`)
    if (!client) {
        try {
            client = await MongoClient.connect(process.env.DATABASE_URI, {
                // useUnifiedTopology: true,
                maxPoolSize: 10,
                // poolSize: 10 <-- Deprecated
            })
            db = await client.db(DB_NAME)
            await db.command({ ping: 1 })
        } catch (err) {
            Logger.error(`Couldn't connect with mongoDB instance at ${process.env.DATABASE_URI}`)
            Logger.error(err)
            process.exit()
        }
    }
}

bootstrap()
