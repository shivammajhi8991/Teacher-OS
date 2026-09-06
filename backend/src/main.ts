import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap() {
  // rawBody: true — docs/04 §4.4 gateway webhook needs the exact request bytes for HMAC signature
  // verification (fees/gateway/*.adapter.ts); Nest exposes them as `req.rawBody` alongside the
  // normally JSON-parsed `req.body`, so no other route is affected.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService<AppConfig, true>);

  app.use(helmet()); // docs/04 §4.8
  app.enableCors({
    origin: configService.get('corsOrigin', { infer: true }),
    credentials: true,
  });
  const apiPrefix = configService.get('apiPrefix', { infer: true });
  app.setGlobalPrefix(apiPrefix); // docs/04 §4.1 → /api/v1

  // docs/02 §2.6 local-disk upload routes (common/storage/local-disk-storage.adapter.ts) — need
  // the exact raw bytes of an arbitrary-content-type body, which Nest's JSON/urlencoded body
  // parsers (content-type-filtered) skip over rather than capture. Registered by literal path
  // (not affected by setGlobalPrefix, which only applies to Nest's own controller routing) and
  // BEFORE any Nest route matching happens, same ordering reasoning as the webhook's rawBody. One
  // line per module using the shared StorageAdapter (Notes, Assignments) — each keeps its own
  // upload-bytes controller route rather than a shared one, per common/storage's own comment.
  app.use(
    `/${apiPrefix}/documents/storage/upload/:objectKey`,
    express.raw({ type: '*/*', limit: '25mb' }),
  );
  app.use(
    `/${apiPrefix}/assignments/storage/upload/:objectKey`,
    express.raw({ type: '*/*', limit: '25mb' }),
  );

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
