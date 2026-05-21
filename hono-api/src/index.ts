import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

// Graceful shutdown ----------------------------------------------------------
let shuttingDown = false;
const shutdown = (signal: NodeJS.Signals) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`\n[shutdown] received ${signal}, closing...`);
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  process.exit(1);
});

// Startup banner -------------------------------------------------------------
console.info(`MSF API ready on http://localhost:${env.PORT} (env=${env.NODE_ENV})`);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
