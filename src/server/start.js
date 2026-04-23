import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  config as defaultConfig,
  mergeConfig,
  validateConfig
} from '../config/index.js';
import { createLogger } from '../utils/logger.js';
import { createApp } from './app.js';

export async function startServer({
  config = {},
  logger = createLogger(),
  createApp: appFactory = createApp,
  app
} = {}) {
  const runtimeConfig = mergeConfig(defaultConfig, config);
  validateConfig(runtimeConfig);
  const server = app ?? appFactory({ logger, config: runtimeConfig });
  const { host, port } = runtimeConfig.server;

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

export function isDirectRun(moduleUrl, entryPath = process.argv[1]) {
  if (!entryPath) {
    return false;
  }

  return path.resolve(fileURLToPath(moduleUrl)) === path.resolve(entryPath);
}

if (isDirectRun(import.meta.url)) {
  startServer().catch((error) => {
    const logger = createLogger();
    logger.error('HTTP server failed to start', {
      error: error.message
    });
    process.exitCode = 1;
  });
}
