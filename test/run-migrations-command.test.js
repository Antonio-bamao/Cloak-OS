import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatMigrationDryRunSummary,
  formatMigrationHelp,
  formatMigrationStatusSummary,
  formatMigrationSummary,
  parseMigrationCliArgs,
  runMigrationStatusCommand,
  runMigrationsCommand
} from '../src/database/run-migrations.js';

test('runMigrationsCommand creates a postgres client, runs migrations, and closes the client', async () => {
  const calls = [];
  const postgresClient = {
    async end() {
      calls.push('end');
    }
  };

  const result = await runMigrationsCommand({
    databaseUrl: 'postgres://cloak:secret@127.0.0.1:5432/cloak',
    createPostgresClient: async (databaseUrl) => {
      calls.push({ type: 'create', databaseUrl });
      return postgresClient;
    },
    runMigrations: async ({ client, migrationsDir }) => {
      calls.push({ type: 'run', client, migrationsDir });
      return {
        appliedMigrations: ['001_initial.sql'],
        skippedMigrations: []
      };
    },
    migrationsDir: 'migrations'
  });

  assert.deepEqual(result, {
    appliedMigrations: ['001_initial.sql'],
    skippedMigrations: []
  });
  assert.deepEqual(calls, [
    {
      type: 'create',
      databaseUrl: 'postgres://cloak:secret@127.0.0.1:5432/cloak'
    },
    {
      type: 'run',
      client: postgresClient,
      migrationsDir: 'migrations'
    },
    'end'
  ]);
});

test('runMigrationsCommand closes the postgres client even when migrations fail', async () => {
  const calls = [];
  const failure = new Error('migration failed');
  const postgresClient = {
    async end() {
      calls.push('end');
    }
  };

  await assert.rejects(
    () =>
      runMigrationsCommand({
        databaseUrl: 'postgres://cloak:secret@127.0.0.1:5432/cloak',
        createPostgresClient: async () => postgresClient,
        runMigrations: async () => {
          throw failure;
        }
      }),
    failure
  );

  assert.deepEqual(calls, ['end']);
});

test('formatMigrationSummary lists applied and skipped migration filenames', () => {
  const summary = formatMigrationSummary({
    appliedMigrations: ['001_initial.sql', '002_access.sql'],
    skippedMigrations: ['000_bootstrap.sql']
  });

  assert.equal(
    summary,
    'Applied 2 migrations: 001_initial.sql, 002_access.sql\nSkipped 1 migrations: 000_bootstrap.sql'
  );
});

test('runMigrationStatusCommand creates a postgres client, collects status, and closes the client', async () => {
  const calls = [];
  const postgresClient = {
    async end() {
      calls.push('end');
    }
  };

  const result = await runMigrationStatusCommand({
    databaseUrl: 'postgres://cloak:secret@127.0.0.1:5432/cloak',
    createPostgresClient: async (databaseUrl) => {
      calls.push({ type: 'create', databaseUrl });
      return postgresClient;
    },
    getMigrationStatus: async ({ client, migrationsDir }) => {
      calls.push({ type: 'status', client, migrationsDir });
      return {
        allMigrations: ['001_initial.sql', '002_access.sql'],
        appliedMigrations: ['001_initial.sql'],
        pendingMigrations: ['002_access.sql']
      };
    },
    migrationsDir: 'migrations'
  });

  assert.deepEqual(result, {
    allMigrations: ['001_initial.sql', '002_access.sql'],
    appliedMigrations: ['001_initial.sql'],
    pendingMigrations: ['002_access.sql']
  });
  assert.deepEqual(calls, [
    {
      type: 'create',
      databaseUrl: 'postgres://cloak:secret@127.0.0.1:5432/cloak'
    },
    {
      type: 'status',
      client: postgresClient,
      migrationsDir: 'migrations'
    },
    'end'
  ]);
});

test('runMigrationStatusCommand accepts a databaseUrl override when postgres config has no inline databaseUrl', async () => {
  const calls = [];
  const postgresClient = {
    async end() {
      calls.push('end');
    }
  };

  await runMigrationStatusCommand({
    config: {
      repository: {
        driver: 'postgres',
        databaseUrl: ''
      }
    },
    databaseUrl: 'postgres://cloak:secret@127.0.0.1:5432/cloak',
    createPostgresClient: async (databaseUrl) => {
      calls.push({ type: 'create', databaseUrl });
      return postgresClient;
    },
    getMigrationStatus: async () => ({
      allMigrations: [],
      appliedMigrations: [],
      pendingMigrations: []
    })
  });

  assert.deepEqual(calls, [
    {
      type: 'create',
      databaseUrl: 'postgres://cloak:secret@127.0.0.1:5432/cloak'
    },
    'end'
  ]);
});

test('formatMigrationStatusSummary lists all, applied, and pending migration filenames', () => {
  const summary = formatMigrationStatusSummary({
    allMigrations: ['001_initial.sql', '002_access.sql'],
    appliedMigrations: ['001_initial.sql'],
    pendingMigrations: ['002_access.sql']
  });

  assert.equal(
    summary,
    'Known 2 migrations: 001_initial.sql, 002_access.sql\nApplied 1 migrations: 001_initial.sql\nPending 1 migrations: 002_access.sql'
  );
});

test('parseMigrationCliArgs defaults to migrate mode without overrides', () => {
  assert.deepEqual(parseMigrationCliArgs([]), {
    mode: 'migrate',
    databaseUrl: undefined,
    migrationsDir: undefined,
    help: false
  });
});

test('parseMigrationCliArgs reads status mode and optional overrides', () => {
  assert.deepEqual(
    parseMigrationCliArgs([
      '--status',
      '--database-url',
      'postgres://cloak:secret@127.0.0.1:5432/cloak',
      '--migrations-dir=custom-migrations'
    ]),
    {
      mode: 'status',
      databaseUrl: 'postgres://cloak:secret@127.0.0.1:5432/cloak',
      migrationsDir: 'custom-migrations',
      help: false
    }
  );
});

test('parseMigrationCliArgs rejects flags that are missing a value', () => {
  assert.throws(
    () => parseMigrationCliArgs(['--database-url']),
    /requires a value/
  );
});

test('parseMigrationCliArgs reads dry-run and help flags', () => {
  assert.deepEqual(parseMigrationCliArgs(['--dry-run', '--help']), {
    mode: 'dry-run',
    databaseUrl: undefined,
    migrationsDir: undefined,
    help: true
  });
});

test('formatMigrationDryRunSummary lists migrations that would run without executing them', () => {
  const summary = formatMigrationDryRunSummary({
    allMigrations: ['001_initial.sql', '002_access.sql'],
    appliedMigrations: ['001_initial.sql'],
    pendingMigrations: ['002_access.sql']
  });

  assert.equal(
    summary,
    'Known 2 migrations: 001_initial.sql, 002_access.sql\nAlready applied 1 migrations: 001_initial.sql\nWould apply 1 migrations: 002_access.sql'
  );
});

test('formatMigrationHelp documents modes and key CLI flags', () => {
  const help = formatMigrationHelp();

  assert.match(help, /--status/);
  assert.match(help, /--dry-run/);
  assert.match(help, /--database-url/);
  assert.match(help, /--migrations-dir/);
});
