import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import api from './routes';
import type { AppEnv } from './types/app-env';

export function createApp() {
  const app = new Hono<AppEnv>();

  // Observability
  app.use('*', requestId());
  // Saat test, logger middleware bikin output noise (request log per assertion).
  if (env.NODE_ENV !== 'test') {
    app.use('*', logger());
  }

  // Security
  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: (origin) => origin ?? '*',
      credentials: true,
      allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-App-Version'],
    }),
  );

  // Health check
  app.get('/health', (c) => c.json({ success: true, data: { status: 'ok', ts: Date.now() } }));

  // Routes
  app.route('/api', api);

  // Error handlers
  app.onError(errorHandler);
  app.notFound(notFoundHandler);

  return app;
}

export type App = ReturnType<typeof createApp>;
