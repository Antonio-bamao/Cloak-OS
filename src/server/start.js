import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  config as defaultConfig,
  mergeConfig,
  validateConfig
} from '../config/index.js';
import { AppError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import { createPostgresClientFactory } from '../infrastructure/postgres/create-postgres-client.js';
import { createApp } from './app.js';

const createDefaultPostgresClient = createPostgresClientFactory();

export async function startServer({
  config = {},
  logger = createLogger(),
  createApp: appFactory = createApp,
  createDefaultPostgresClient: defaultPostgresClientFactory = createDefaultPostgresClient,
  createPostgresClient,
  postgresClient,
  app
} = {}) {
  const runtimeConfig = mergeConfig(defaultConfig, config);
  validateConfig(runtimeConfig);
  const { postgresClient: resolvedPostgresClient, shouldDispose } = await resolvePostgresClient({
    config: runtimeConfig,
    postgresClient,
    createPostgresClient,
    createDefaultPostgresClient: defaultPostgresClientFactory
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

  return attachPostgresClientDisposer(server, {
    postgresClient: resolvedPostgresClient,
    shouldDispose
  });
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
  createPostgresClient,
  createDefaultPostgresClient
}) {
  if (config.repository?.driver !== 'postgres') {
    return {
      postgresClient,
      shouldDispose: false
    };
  }

  if (postgresClient) {
    return {
      postgresClient,
      shouldDispose: false
    };
  }

  if (createPostgresClient) {
    return {
      postgresClient: await createPostgresClient(config.repository.databaseUrl),
      shouldDispose: false
    };
  }

  if (createDefaultPostgresClient) {
    return {
      postgresClient: await createDefaultPostgresClient(config.repository.databaseUrl),
      shouldDispose: true
    };
  }

  throw new AppError(
    'repository.driver=postgres requires postgresClient or createPostgresClient',
    500,
    'POSTGRES_CLIENT_REQUIRED'
  );
}

function attachPostgresClientDisposer(server, { postgresClient, shouldDispose }) {
  if (!shouldDispose || typeof postgresClient?.end !== 'function') {
    return server;
  }

  const originalClose = server.close?.bind(server);

  if (!originalClose) {
    return server;
  }

  server.close = (callback) => {
    return originalClose(async (error) => {
      if (error) {
        callback?.(error);
        return;
      }

      try {
        await postgresClient.end();
        callback?.();
      } catch (disposeError) {
        callback?.(disposeError);
      }
    });
  };

  return server;
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
