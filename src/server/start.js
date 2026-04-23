import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  config as defaultConfig,
  mergeConfig,
  validateConfig
} from '../config/index.js';
import { AppError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import { createApp } from './app.js';

export async function startServer({
  config = {},
  logger = createLogger(),
  createApp: appFactory = createApp,
  createPostgresClient,
  postgresClient,
  app
} = {}) {
  const runtimeConfig = mergeConfig(defaultConfig, config);
  validateConfig(runtimeConfig);
  const resolvedPostgresClient = await resolvePostgresClient({
    config: runtimeConfig,
    postgresClient,
    createPostgresClient
  });
  const server = app ?? appFactory({
    logger,
    config: runtimeConfig,
    postgresClient: resolvedPostgresClient
  });
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

async function resolvePostgresClient({
  config,
  postgresClient,
  createPostgresClient
}) {
  if (config.repository?.driver !== 'postgres') {
    return postgresClient;
  }

  if (postgresClient) {
    return postgresClient;
  }

  if (createPostgresClient) {
    return createPostgresClient(config.repository.databaseUrl);
  }

  throw new AppError(
    'repository.driver=postgres requires postgresClient or createPostgresClient',
    500,
    'POSTGRES_CLIENT_REQUIRED'
  );
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
