import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export function configurarHttp(app: INestApplication) {
  const config = app.get(ConfigService);
  const origenes = config
    .get<string>('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origenes,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.enableShutdownHooks();
}
