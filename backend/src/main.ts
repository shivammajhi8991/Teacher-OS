import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService<AppConfig, true>);

  app.use(helmet()); // docs/04 §4.8
  app.enableCors({
    origin: configService.get('corsOrigin', { infer: true }),
    credentials: true,
  });
  app.setGlobalPrefix(configService.get('apiPrefix', { infer: true })); // docs/04 §4.1 → /api/v1

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips unknown properties — first line of input-validation defense (docs/04 §4.8)
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = configService.get('port', { infer: true });
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(
    `TeacherOS API listening on :${port}/${configService.get('apiPrefix', { infer: true })}`,
  );
}

bootstrap();
