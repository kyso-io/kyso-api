/* eslint-disable @typescript-eslint/no-var-requires */
import { RedocModule, RedocOptions } from '@juicyllama/nestjs-redoc';
import { KysoSetting, KysoSettingsEnum } from '@kyso-io/kyso-model';
import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import helmet from 'helmet';
import { MongoClient } from 'mongodb';
import { join } from 'path';
import { AppModule } from './app.module';
import { getSingletons, registerSingleton } from './decorators/autowired';
import { GenericExceptionFilter } from './filters/generic-exception.filter';
import { TransformInterceptor } from './interceptors/exclude.interceptor';
import { KysoSettingsService } from './modules/kyso-settings/kyso-settings.service';
import { TestingDataPopulatorService } from './modules/testing-data-populator/testing-data-populator.service';
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { NestInstrumentation } = require('@opentelemetry/instrumentation-nestjs-core');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');

export let client;
export let db;
export let mailTransport;
export let mailFrom;
const cspDefaults = helmet.contentSecurityPolicy.getDefaultDirectives();
delete cspDefaults['upgrade-insecure-requests'];

const provider = new NodeTracerProvider();
provider.register();

registerInstrumentations({
  instrumentations: [new NestInstrumentation()],
});

// Auxiliary function to terminate the main process
async function terminate_process() {
  // Use process.kill instead of process.exit to end the dev execution.
  // See: https://github.com/nestjs/nest/issues/8077#issuecomment-922443560
  Logger.warn(`Terminating process in 10 seconds.`);
  const timer = (ms) => new Promise((res) => setTimeout(res, ms));
  await timer(10000);
  process.kill(0);
}

async function bootstrap() {
  let app_mount_dir = '';
  let dotenv_path = '.env';
  if (process.env.DOTENV_FILE) {
    dotenv_path = process.env.DOTENV_FILE;
  }
  Logger.log(`Loading ${dotenv_path}`);

  await dotenv.config({
    path: dotenv_path,
  });

  // Check if APP_TEMP_DIR is set use a default value
  if (!process.env.APP_TEMP_DIR) {
    process.env.APP_TEMP_DIR = `${process.cwd()}/data`;
  }

  // create the temp dir if it does not exist; note that if the directory exists
  // and recursive is set to true mkdir does not return an error
  fs.mkdir(process.env.APP_TEMP_DIR, { recursive: true }, (error) => {
    if (error) {
      Logger.log(`Could not create '${process.env.APP_TEMP_DIR}' folder`);
      Logger.log(`Error was '${error}'`);
      Logger.log('Set the right value for APP_TEMP_DIR');
      terminate_process();
    } else {
      Logger.log(`Using '${process.env.APP_TEMP_DIR}' as the temp folder`);
    }
  });

  if (process.env.APP_MOUNT_DIR) {
    app_mount_dir = process.env.APP_MOUNT_DIR;
  }

  await connectToDatabase();

  let maxFileSize = '';
  try {
    const kysoSettingCollection = db.collection('KysoSettings');
    const mailTransportValue = await kysoSettingCollection.find({ key: KysoSettingsEnum.MAIL_TRANSPORT }).toArray();
    const mailFromValue = await kysoSettingCollection.find({ key: KysoSettingsEnum.MAIL_FROM }).toArray();

    if (mailTransportValue.length === 0) {
      // set default value
      mailTransport = KysoSettingsService.getKysoSettingDefaultValue(KysoSettingsEnum.MAIL_TRANSPORT);
    } else {
      mailTransport = mailTransportValue[0].value;
    }

    if (mailFromValue.length === 0) {
      // set default value
      mailFrom = KysoSettingsService.getKysoSettingDefaultValue(KysoSettingsEnum.MAIL_FROM);
    } else {
      mailFrom = mailFromValue[0].value;
    }
    const maxFileSizeKysoSetting: KysoSetting = await kysoSettingCollection.findOne({ key: KysoSettingsEnum.MAX_FILE_SIZE });
    if (!maxFileSizeKysoSetting) {
      maxFileSize = KysoSettingsService.getKysoSettingDefaultValue(KysoSettingsEnum.MAX_FILE_SIZE);
    } else {
      maxFileSize = maxFileSizeKysoSetting.value;
    }
  } catch (ex) {
    mailTransport = KysoSettingsService.getKysoSettingDefaultValue(KysoSettingsEnum.MAIL_TRANSPORT);
    mailFrom = KysoSettingsService.getKysoSettingDefaultValue(KysoSettingsEnum.MAIL_FROM);
  }

  const app = await NestFactory.create(AppModule);

  // Serve files in ./public from the application working directory
  const publicPath = join(process.cwd(), 'public');
  (app as any).useStaticAssets(publicPath, { prefix: `${app_mount_dir}` });
  Logger.log(`Serving static assets from '${publicPath} with prefix '${app_mount_dir}'`);
  app.use(cookieParser());
  app.use(bodyParser.json({ limit: maxFileSize }));
  app.use(bodyParser.urlencoded({ limit: maxFileSize, extended: true }));

  app.useGlobalFilters(new GenericExceptionFilter());

  const globalPrefix = app_mount_dir + '/v1';
  // Helmet can help protect an app from some well-known web vulnerabilities by setting HTTP headers appropriately
  let helmetOpts = {};
  if (process.env.NODE_ENV === 'development') {
    //https://github.com/scottie1984/swagger-ui-express/issues/237
    helmetOpts = {
      contentSecurityPolicy: { directives: cspDefaults },
    };
  }
  app.use(helmet(helmetOpts));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.setGlobalPrefix(globalPrefix);

  const config = new DocumentBuilder().setTitle(`Kyso's API`).setDescription(`Spec for Kyso's API`).setVersion('v1').addBearerAuth().build();

  const document = SwaggerModule.createDocument(app, config);

  const jsonFile = './dist/src/openapi.json';
  Logger.log(`Writing openapi.json to ${jsonFile}`);
  fs.writeFileSync(jsonFile, JSON.stringify(document, null, 2));

  // Publish swagger documentation under /docs (in production is not
  // accessible unless the ingress service publishes it)
  SwaggerModule.setup(app_mount_dir + '/docs', app, document);

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
  };

  const redocDocument = Object.assign({}, document);

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
  ];

  await RedocModule.setup(app_mount_dir + '/redoc', app, redocDocument, redocOptions);
  app.enableCors();
  await app.listen(process.env.PORT || 4000);

  if (process.env.POPULATE_TEST_DATA === 'true') {
    setTimeout(async () => {
      const testingDataPopulatorService: TestingDataPopulatorService = app.get(TestingDataPopulatorService);
      await testingDataPopulatorService.populateTestData();
    }, 10000);
  }

  // Autowired extension to allow injection outside the constructor and avoid circular dependencies
  const singletons: string[] = getSingletons();

  singletons.forEach((x: any) => {
    const instance = app.get(x);
    registerSingleton(x, instance);
  });
}

async function connectToDatabase() {
  if (!client) {
    try {
      Logger.log(`Connecting to ${process.env.DATABASE_URI}`);

      let connectionOptions;

      if (process.env.NODE_ENV === 'development') {
        connectionOptions = {
          // useUnifiedTopology: true,
          maxPoolSize: 10,
          // poolSize: 10 <-- Deprecated
          directConnection: true,
        };
      } else {
        connectionOptions = {
          // useUnifiedTopology: true,
          maxPoolSize: 10,
          // poolSize: 10 <-- Deprecated
        };
      }

      client = await MongoClient.connect(process.env.DATABASE_URI, connectionOptions);
      Logger.log(`Connecting to database... ${client.s.options.dbName}`);
      db = await client.db(client.s.options.dbName);
      await db.command({ ping: 1 });
    } catch (err) {
      Logger.error(`Couldn't connect with mongoDB instance at ${process.env.DATABASE_URI}`);
      Logger.error(err);
      terminate_process();
    }
  }
}

bootstrap();
