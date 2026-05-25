import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import api from './routes';
import type { AppEnv } from './types/app-env';

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use('*', logger());
  app.use(
    '*',
    cors({
      origin: (origin) => origin ?? '*',
      credentials: true,
      allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-App-Version'],
    }),
  );

  app.get('/health', (c) => c.json({ status: 'ok', ts: Date.now() }));

  app.route('/api', api);

  app.onError(errorHandler);
  app.notFound(notFoundHandler);

  return app;
}

export type App = ReturnType<typeof createApp>;
