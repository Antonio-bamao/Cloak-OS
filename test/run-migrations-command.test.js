import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatMigrationDryRunSummary,
  formatMigrationHelp,
  formatMigrationStatusSummary,
  formatMigrationSummary,
  parseMigrationCliArgs,
  runMigrationCli,
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

test('runMigrationCli prints help without touching the database', async () => {
  const stdout = [];
  const stderr = [];
  const result = await runMigrationCli({
    argv: ['--help'],
    stdout: { write(message) { stdout.push(message); } },
    stderr: { write(message) { stderr.push(message); } },
    runMigrationsCommand: async () => {
      throw new Error('should not run');
    },
    runMigrationStatusCommand: async () => {
      throw new Error('should not run');
    }
  });

  assert.equal(result.exitCode, 0);
  assert.match(stdout.join(''), /Migration CLI/);
  assert.deepEqual(stderr, []);
});

test('runMigrationCli dispatches dry-run mode through status command and writes dry-run summary', async () => {
  const stdout = [];
  const result = await runMigrationCli({
    argv: ['--dry-run', '--database-url', 'postgres://cloak:secret@127.0.0.1:5432/cloak'],
    stdout: { write(message) { stdout.push(message); } },
    stderr: { write() {} },
    runMigrationStatusCommand: async ({ databaseUrl }) => {
      assert.equal(databaseUrl, 'postgres://cloak:secret@127.0.0.1:5432/cloak');
      return {
        allMigrations: ['001_initial.sql'],
        appliedMigrations: [],
        pendingMigrations: ['001_initial.sql']
      };
    },
    runMigrationsCommand: async () => {
      throw new Error('should not run migrate command');
    }
  });

  assert.equal(result.exitCode, 0);
  assert.match(stdout.join(''), /Would apply 1 migrations/);
});

test('runMigrationCli dispatches migrate mode and writes migration summary', async () => {
  const stdout = [];
  const result = await runMigrationCli({
    argv: ['--database-url', 'postgres://cloak:secret@127.0.0.1:5432/cloak'],
    stdout: { write(message) { stdout.push(message); } },
    stderr: { write() {} },
    runMigrationsCommand: async ({ databaseUrl }) => {
      assert.equal(databaseUrl, 'postgres://cloak:secret@127.0.0.1:5432/cloak');
      return {
        appliedMigrations: ['001_initial.sql'],
        skippedMigrations: []
      };
    },
    runMigrationStatusCommand: async () => {
      throw new Error('should not run status command');
    }
  });

  assert.equal(result.exitCode, 0);
  assert.match(stdout.join(''), /Applied 1 migrations/);
});

test('runMigrationCli writes errors to stderr and returns exitCode 1', async () => {
  const stderr = [];
  const result = await runMigrationCli({
    argv: ['--status'],
    stdout: { write() {} },
    stderr: { write(message) { stderr.push(message); } },
    runMigrationStatusCommand: async () => {
      throw new Error('db unavailable');
    }
  });

  assert.equal(result.exitCode, 1);
  assert.match(stderr.join(''), /db unavailable/);
});
