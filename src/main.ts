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
    .addTag("Filtering", "General notes about filtering", {
      description: fs.readFileSync('./src/openapi/filtering.md','utf8'),
      url: "https://kyso.io"
    })
    .build();

    
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(globalPrefix, app, document);

  const redocOptions: RedocOptions = {
    title: 'Hello Nest',
    logo: {
      url: 'https://blog.kyso.io/hubfs/kyso.io%20dark3-1.png',
      backgroundColor: '#F0F0F0',
      altText: 'Kyso.io logo'
    },
    sortPropsAlphabetically: true,
    hideDownloadButton: false,
    hideHostname: false
  };
  // Instead of using SwaggerModule.setup() you call this module
  await RedocModule.setup('/redoc', app, document, redocOptions);
  
  await app.listen(3000);
}

const bindSwaggerDocument = (globalPrefix: string, app: INestApplication) => {
  
};



bootstrap();
