import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as helmet from 'helmet';
import { INestApplication } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = "v1";
  // Helmet can help protect an app from some well-known web vulnerabilities by setting HTTP headers appropriately
  app.use(helmet());
  app.setGlobalPrefix(globalPrefix);
  
  bindSwaggerDocument(globalPrefix, app);
  
  await app.listen(3000);
}

const bindSwaggerDocument = (path: string, app: INestApplication) => {
  const config = new DocumentBuilder()
    .setTitle(`Kyso's API`)
    .setDescription(`A description`)
    .setVersion('1.0.0')
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(path, app, document);
};



bootstrap();
