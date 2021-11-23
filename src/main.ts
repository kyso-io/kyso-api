import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Helmet can help protect an app from some well-known web vulnerabilities by setting HTTP headers appropriately
  app.use(helmet());
 
  const config = new DocumentBuilder()
    .setTitle(`Kyso's API`)
    .setVersion('1.0.0')
    .build();
   
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  
  await app.listen(3000);
}

bootstrap();
