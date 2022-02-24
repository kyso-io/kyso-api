/* eslint-disable @typescript-eslint/no-var-requires */
import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory, Reflector } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import * as bodyParser from 'body-parser'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as helmet from 'helmet'
import { MongoClient } from 'mongodb'
import { RedocModule, RedocOptions } from 'nestjs-redoc'
import { AppModule } from './app.module'
import { getSingletons, registerSingleton } from './decorators/autowired'
import { TransformInterceptor } from './interceptors/exclude.interceptor'
import { TestingDataPopulatorService } from './modules/testing-data-populator/testing-data-populator.service'
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node')
const { NestInstrumentation } = require('@opentelemetry/instrumentation-nestjs-core')
const { registerInstrumentations } = require('@opentelemetry/instrumentation')
export const passport = require('passport');
const passportSaml = require('passport-saml');

export let client
export let db
export let mailTransport
export let mailFrom
const cspDefaults = helmet.contentSecurityPolicy.getDefaultDirectives()
delete cspDefaults['upgrade-insecure-requests']

const provider = new NodeTracerProvider()
provider.register()

registerInstrumentations({
    instrumentations: [new NestInstrumentation()],
})

passport.serializeUser((user, done) => {
    done(null, user);
});
  
passport.deserializeUser((user, done) => {
    done(null, user);
});

// SAML strategy for passport -- Single IPD
const strategy = new passportSaml.Strategy(
    {
      entryPoint: 'https://auth.pingone.eu/0fda3448-9115-4ca7-b9d3-269d6029276a/saml20/idp/startsso?spEntityId=kyso-api-entity-id',
      issuer: 'https://auth.pingone.eu/0fda3448-9115-4ca7-b9d3-269d6029276a',
      callbackUrl: 'http://localhost:4000/auth/pingid/callback',
      cert: `MIIDcDCCAligAwIBAgIGAX75b59+MA0GCSqGSIb3DQEBCwUAMHkxCzAJBgNVBAYT
             AlVTMRYwFAYDVQQKDA1QaW5nIElkZW50aXR5MRYwFAYDVQQLDA1QaW5nIElkZW50
             aXR5MTowOAYDVQQDDDFQaW5nT25lIFNTTyBDZXJ0aWZpY2F0ZSBmb3Iga3lzby1w
             aW5nIGVudmlyb25tZW50MB4XDTIyMDIxNDE4MTIyOVoXDTIzMDIxNDE4MTIyOVow
             eTELMAkGA1UEBhMCVVMxFjAUBgNVBAoMDVBpbmcgSWRlbnRpdHkxFjAUBgNVBAsM
             DVBpbmcgSWRlbnRpdHkxOjA4BgNVBAMMMVBpbmdPbmUgU1NPIENlcnRpZmljYXRl
             IGZvciBreXNvLXBpbmcgZW52aXJvbm1lbnQwggEiMA0GCSqGSIb3DQEBAQUAA4IB
             DwAwggEKAoIBAQDTxYEcnkl/l0EcIHrfrMVhXUAQrJ65mPAHMjZ7O0Q5aCYMAoN4
             fIRsWVsQsoCat7WiijfpNmQAeyJo5Qc7S+XD0mmzSdO5E2ulxGDD9KSvdV32AGTZ
             lzDZiwIjFgK+jm8guBsxeVgUA3IUVrHb93r7xuTUpvQjY/egs2l7AsSv3n7wjZoU
             SXz6FAAYGOstfm5mqODXDRhswAqLX/l0sc0PvkORRUYKjZm7Lf8H3uybJc0oABC1
             vY0yvZch1PoBQvAFGVQCoazijwFyGLApGcx06m9FuAcNkx+iQaeh4cQXMwqQ7vzX
             Y8YfwomFG1OR7a3whRGWlxTcHZXYqHkkfXTZAgMBAAEwDQYJKoZIhvcNAQELBQAD
             ggEBACeCz88vgr/C++1JGbrBGIIlB7XnLcSaEyVKWXyXsA0gTaXA0oVkgslSwOs8
             Cyj0UKPdJsTniqMykGfNhkCX+mxKnhhY57Jae1bjGxtXNb0PTnCB7P4lONFB2ySY
             e51+PkPcU9gzzoq8V/By8gssnGsSvTYvjEl0lMRaP0/pM6wiqCTkAB93SRjczrKj
             TbORNSrRQz8IvChzfsSNFHfV0WHVFXFHddKvb8g2+Qpy6G+BRGW5Pu9eQ0M0ZaZ0
             xTjh5BVBe19jM+IZSDI4pLGCeqYXsreRzf4gOvU21l9vjWk/W8nk2RDx3x1cEXZY
             s10Z8am4rg0GO1c1ka5tiLC/5iw=`,
    },
    (profile, done) => done(null, profile),
  );
  
passport.use(strategy);
  

async function bootstrap() {
    let app_mount_dir = ''
    let dotenv_path = '.env'
    if (process.env.DOTENV_FILE) {
        dotenv_path = process.env.DOTENV_FILE
    }
    Logger.log(`Loading ${dotenv_path}`)

    await dotenv.config({
        path: dotenv_path,
    })

    mailTransport = process.env.MAIL_TRANSPORT
    mailFrom = process.env.MAIL_FROM

    if (process.env.APP_MOUNT_DIR) {
        app_mount_dir = process.env.APP_MOUNT_DIR
    }
    await connectToDatabase(process.env.DATABASE_NAME || 'kyso')
    const app = await NestFactory.create<NestExpressApplication>(AppModule)

    // Serve files in ./public on the root of the application
    app.useStaticAssets('./public', {prefix: app_mount_dir + '/'});

    app.use(bodyParser.json({ limit: '500mb' }))
    app.use(bodyParser.urlencoded({ limit: '500mb', extended: true }))

    const globalPrefix = app_mount_dir + '/v1'
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

    const jsonFile = './dist/src/openapi.json'
    Logger.log(`Writing openapi.json to ${jsonFile}`)
    fs.writeFileSync(jsonFile, JSON.stringify(document, null, 2))

    // Publish swagger documentation under /docs (in production is not
    // accessible unless the ingress service publishes it)
    SwaggerModule.setup(app_mount_dir + '/docs', app, document)

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

    await RedocModule.setup(app_mount_dir + '/redoc', app, redocDocument, redocOptions)
    app.enableCors()
    await app.listen(process.env.PORT || 4000)

    if (process.env.POPULATE_TEST_DATA === 'true') {
        setTimeout(async () => {
            const testingDataPopulatorService: TestingDataPopulatorService = app.get(TestingDataPopulatorService)
            await testingDataPopulatorService.populateTestData()
        }, 10000)
    }

    // Autowired extension to allow injection outside the constructor and avoid circular dependencies
    const singletons: string[] = getSingletons()

    singletons.forEach((x: any) => {
        const instance = app.get(x)
        registerSingleton(x, instance)
    })
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
