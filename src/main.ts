import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as helmet from 'helmet';
import { INestApplication } from '@nestjs/common';
import * as fs from 'fs';
import { RedocOptions, RedocModule } from 'nestjs-redoc';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = "v1";
  // Helmet can help protect an app from some well-known web vulnerabilities by setting HTTP headers appropriately
  app.use(helmet());
  app.setGlobalPrefix(globalPrefix);
  
  // bindSwaggerDocument(globalPrefix, app);
  
  const config = new DocumentBuilder()
    .setTitle(`Kyso's API`)
    .setDescription(`Spec for Kyso's API`)
    .setVersion('v1')
    .setLicense("Apache 2.0", "http://www.apache.org/licenses/LICENSE-2.0.html")
    .build();
    
  
  const document = SwaggerModule.createDocument(app, config);
  
  // TODO: Only publish in development / staging mode, remove for production
  SwaggerModule.setup(globalPrefix, app, document);

  const redocOptions: RedocOptions = {
    title: 'Kyso API',
    favicon: 'https://kyso.io/static/images/white-logo.svg',
    logo: {
      url: 'https://raw.githubusercontent.com/kyso-io/brand/master/kyso-white.svg',
      backgroundColor: '#002A60',
      altText: 'Kyso.io logo'
    },
    sortPropsAlphabetically: true,
    hideDownloadButton: false,
    hideHostname: false
  };

  let redocDocument = Object.assign({}, document);
  
  // Only for redocs, add general documentation data (tags)
  redocDocument.tags = [
    {
      name: "Filtering",
      description: fs.readFileSync('./src/openapi/filtering.md','utf8')
    },
    {
      name: "Projection",
      description: fs.readFileSync('./src/openapi/projection.md','utf8')
    },
    {
      name: "Sorting",
      description: fs.readFileSync('./src/openapi/sorting.md','utf8')
    },
    {
      name: "Pagination", 
      description: fs.readFileSync('./src/openapi/pagination.md','utf8')
    }
  ];

  // Instead of using SwaggerModule.setup() you call this module
  await RedocModule.setup('/redoc', app, redocDocument, redocOptions);
  
  await app.listen(3000);
}

const bindSwaggerDocument = (globalPrefix: string, app: INestApplication) => {
  
};



bootstrap();
