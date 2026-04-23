import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as defaultConfig, mergeConfig, validateConfig } from '../config/index.js';
import { createPostgresClientFactory } from '../infrastructure/postgres/create-postgres-client.js';
import {
  getMigrationStatus as collectMigrationStatus,
  runMigrations as executeMigrations
} from './migration-runner.js';

const defaultCreatePostgresClient = createPostgresClientFactory();

export async function runMigrationsCommand({
  config = {},
  databaseUrl,
  createPostgresClient = defaultCreatePostgresClient,
  runMigrations = executeMigrations,
  migrationsDir = path.resolve(process.cwd(), 'migrations')
} = {}) {
  const runtimeConfig = mergeConfig(defaultConfig, config);
  validateConfig(runtimeConfig);
  const resolvedDatabaseUrl = databaseUrl ?? runtimeConfig.repository.databaseUrl;
  const client = await createPostgresClient(resolvedDatabaseUrl);

  try {
    return await runMigrations({
      client,
      migrationsDir
    });
  } finally {
    await client.end?.();
  }
}

export async function runMigrationStatusCommand({
  config = {},
  databaseUrl,
  createPostgresClient = defaultCreatePostgresClient,
  getMigrationStatus = collectMigrationStatus,
  migrationsDir = path.resolve(process.cwd(), 'migrations')
} = {}) {
  const runtimeConfig = mergeConfig(defaultConfig, config);
  validateConfig(runtimeConfig);
  const resolvedDatabaseUrl = databaseUrl ?? runtimeConfig.repository.databaseUrl;
  const client = await createPostgresClient(resolvedDatabaseUrl);

  try {
    return await getMigrationStatus({
      client,
      migrationsDir
    });
  } finally {
    await client.end?.();
  }
}

export function formatMigrationSummary({
  appliedMigrations = [],
  skippedMigrations = []
} = {}) {
  return [
    `Applied ${appliedMigrations.length} migrations: ${formatMigrationList(appliedMigrations)}`,
    `Skipped ${skippedMigrations.length} migrations: ${formatMigrationList(skippedMigrations)}`
  ].join('\n');
}

export function formatMigrationStatusSummary({
  allMigrations = [],
  appliedMigrations = [],
  pendingMigrations = []
} = {}) {
  return [
    `Known ${allMigrations.length} migrations: ${formatMigrationList(allMigrations)}`,
    `Applied ${appliedMigrations.length} migrations: ${formatMigrationList(appliedMigrations)}`,
    `Pending ${pendingMigrations.length} migrations: ${formatMigrationList(pendingMigrations)}`
  ].join('\n');
}

export function isDirectRun(moduleUrl, entryPath = process.argv[1]) {
  if (!entryPath) {
    return false;
  }

  return path.resolve(fileURLToPath(moduleUrl)) === path.resolve(entryPath);
}

if (isDirectRun(import.meta.url)) {
  const mode = process.argv.includes('--status') ? 'status' : 'migrate';
  const command =
    mode === 'status'
      ? runMigrationStatusCommand({
          config: {
            repository: {
              driver: 'postgres'
            }
          }
        }).then((result) => {
          console.log(formatMigrationStatusSummary(result));
        })
      : runMigrationsCommand({
          config: {
            repository: {
              driver: 'postgres'
            }
          }
        }).then((result) => {
          console.log(formatMigrationSummary(result));
        });

  command.catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

function formatMigrationList(filenames) {
  return filenames.length > 0 ? filenames.join(', ') : '(none)';
}
