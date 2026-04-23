import { config as defaultConfig } from '../config/index.js';
import { createLogger } from '../utils/logger.js';
import { createApp } from './app.js';

export async function startServer({
  config = defaultConfig,
  logger = createLogger(),
  app
} = {}) {
  const server = app ?? createApp({ logger, config });
  const { host, port } = config.server;

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  const address = server.address();
  logger.info('HTTP server started', {
    host: address.address,
    port: address.port
  });

  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    const logger = createLogger();
    logger.error('HTTP server failed to start', {
      error: error.message
    });
    process.exitCode = 1;
  });
}
