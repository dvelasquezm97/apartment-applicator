import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { startAllWorkers } from './workers/index.js';

async function start(): Promise<void> {
  logger.info('Starting worker process');
  await startAllWorkers();
  logger.info('Worker process ready');
}

start().catch((err) => {
  logger.fatal(err, 'Failed to start worker process');
  process.exit(1);
});
