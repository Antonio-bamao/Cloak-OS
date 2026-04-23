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
  const resolvedDatabaseUrl = databaseUrl ?? runtimeConfig.repository.databaseUrl;
  const validatedConfig = mergeConfig(runtimeConfig, {
    repository: {
      databaseUrl: resolvedDatabaseUrl
    }
  });

  validateConfig(validatedConfig);
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
  const resolvedDatabaseUrl = databaseUrl ?? runtimeConfig.repository.databaseUrl;
  const validatedConfig = mergeConfig(runtimeConfig, {
    repository: {
      databaseUrl: resolvedDatabaseUrl
    }
  });

  validateConfig(validatedConfig);
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

export function formatMigrationDryRunSummary({
  allMigrations = [],
  appliedMigrations = [],
  pendingMigrations = []
} = {}) {
  return [
    `Known ${allMigrations.length} migrations: ${formatMigrationList(allMigrations)}`,
    `Already applied ${appliedMigrations.length} migrations: ${formatMigrationList(appliedMigrations)}`,
    `Would apply ${pendingMigrations.length} migrations: ${formatMigrationList(pendingMigrations)}`
  ].join('\n');
}

export function formatMigrationHelp() {
  return [
    'Migration CLI',
    '',
    'Modes:',
    '  default               Run pending migrations',
    '  --status              Show applied and pending migrations',
    '  --dry-run             Show which migrations would run without executing them',
    '',
    'Flags:',
    '  --database-url <url>  Override DATABASE_URL for this command',
    '  --migrations-dir <dir> Override the migrations directory',
    '  --help                Show this help text'
  ].join('\n');
}

export function parseMigrationCliArgs(argv = process.argv.slice(2)) {
  const parsed = {
    mode: 'migrate',
    databaseUrl: undefined,
    migrationsDir: undefined,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--help') {
      parsed.help = true;
      continue;
    }

    if (argument === '--status') {
      parsed.mode = 'status';
      continue;
    }

    if (argument === '--dry-run') {
      parsed.mode = 'dry-run';
      continue;
    }

    if (argument === '--database-url') {
      parsed.databaseUrl = requireCliValue(argv, index, '--database-url');
      index += 1;
      continue;
    }

    if (argument.startsWith('--database-url=')) {
      parsed.databaseUrl = argument.slice('--database-url='.length);
      continue;
    }

    if (argument === '--migrations-dir') {
      parsed.migrationsDir = requireCliValue(argv, index, '--migrations-dir');
      index += 1;
      continue;
    }

    if (argument.startsWith('--migrations-dir=')) {
      parsed.migrationsDir = argument.slice('--migrations-dir='.length);
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return parsed;
}

export function isDirectRun(moduleUrl, entryPath = process.argv[1]) {
  if (!entryPath) {
    return false;
  }

  return path.resolve(fileURLToPath(moduleUrl)) === path.resolve(entryPath);
}

export async function runMigrationCli({
  argv = process.argv.slice(2),
  stdout = process.stdout,
  stderr = process.stderr,
  runMigrationsCommand: executeMigrationCommand = runMigrationsCommand,
  runMigrationStatusCommand: executeMigrationStatusCommand = runMigrationStatusCommand
} = {}) {
  try {
    const cliArgs = parseMigrationCliArgs(argv);

    if (cliArgs.help) {
      stdout.write(`${formatMigrationHelp()}\n`);
      return { exitCode: 0 };
    }

    if (cliArgs.mode === 'status' || cliArgs.mode === 'dry-run') {
      const result = await executeMigrationStatusCommand({
        databaseUrl: cliArgs.databaseUrl,
        migrationsDir: cliArgs.migrationsDir,
        config: {
          repository: {
            driver: 'postgres'
          }
        }
      });

      stdout.write(
        `${cliArgs.mode === 'dry-run'
          ? formatMigrationDryRunSummary(result)
          : formatMigrationStatusSummary(result)}\n`
      );
      return { exitCode: 0 };
    }

    const result = await executeMigrationCommand({
      databaseUrl: cliArgs.databaseUrl,
      migrationsDir: cliArgs.migrationsDir,
      config: {
        repository: {
          driver: 'postgres'
        }
      }
    });

    stdout.write(`${formatMigrationSummary(result)}\n`);
    return { exitCode: 0 };
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return { exitCode: 1, error };
  }
}

if (isDirectRun(import.meta.url)) {
  runMigrationCli().then(({ exitCode }) => {
    process.exitCode = exitCode;
  });
}

function formatMigrationList(filenames) {
  return filenames.length > 0 ? filenames.join(', ') : '(none)';
}

function requireCliValue(argv, index, flagName) {
  const value = argv[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`Flag ${flagName} requires a value.`);
  }

  return value;
}
