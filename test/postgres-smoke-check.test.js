import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatPostgresSmokeCheckHelp,
  formatPostgresSmokeCheckSummary,
  parsePostgresSmokeCheckArgs,
  runPostgresSmokeCheck
} from '../src/database/run-postgres-smoke-check.js';

test('parsePostgresSmokeCheckArgs reads database-url and migrations-dir overrides', () => {
  assert.deepEqual(
    parsePostgresSmokeCheckArgs([
      '--database-url',
      'postgres://cloak:secret@127.0.0.1:5432/cloak',
      '--migrations-dir=custom-migrations'
    ]),
    {
      databaseUrl: 'postgres://cloak:secret@127.0.0.1:5432/cloak',
      migrationsDir: 'custom-migrations',
      help: false
    }
  );
});

test('parsePostgresSmokeCheckArgs supports --help', () => {
  assert.deepEqual(parsePostgresSmokeCheckArgs(['--help']), {
    databaseUrl: undefined,
    migrationsDir: undefined,
    help: true
  });
});

test('formatPostgresSmokeCheckSummary includes migration status and dry-run sections', () => {
  const summary = formatPostgresSmokeCheckSummary({
    statusSummary: 'Known 2 migrations: 001_initial.sql, 002_access.sql',
    dryRunSummary:
      'Known 2 migrations: 001_initial.sql, 002_access.sql\nWould apply 1 migrations: 002_access.sql'
  });

  assert.match(summary, /PostgreSQL smoke check passed/);
  assert.match(summary, /Migration status:/);
  assert.match(summary, /Migration dry run:/);
});

test('formatPostgresSmokeCheckHelp documents readonly smoke-check behavior', () => {
  const help = formatPostgresSmokeCheckHelp();

  assert.match(help, /smoke check/i);
  assert.match(help, /--database-url/);
  assert.match(help, /--migrations-dir/);
  assert.match(help, /readonly/i);
});

test('runPostgresSmokeCheck prints help without touching the database', async () => {
  const stdout = [];
  const stderr = [];

  const result = await runPostgresSmokeCheck({
    argv: ['--help'],
    stdout: { write(message) { stdout.push(message); } },
    stderr: { write(message) { stderr.push(message); } },
    runMigrationStatusCommand: async () => {
      throw new Error('should not run');
    }
  });

  assert.equal(result.exitCode, 0);
  assert.match(stdout.join(''), /PostgreSQL Smoke Check CLI/);
  assert.deepEqual(stderr, []);
});

test('runPostgresSmokeCheck prints readonly status and dry-run summaries', async () => {
  const stdout = [];
  const stderr = [];
  const calls = [];

  const result = await runPostgresSmokeCheck({
    argv: ['--database-url', 'postgres://cloak:secret@127.0.0.1:5432/cloak'],
    stdout: { write(message) { stdout.push(message); } },
    stderr: { write(message) { stderr.push(message); } },
    runMigrationStatusCommand: async ({ databaseUrl, migrationsDir, config }) => {
      calls.push({ databaseUrl, migrationsDir, config });
      return {
        allMigrations: ['001_initial.sql', '002_access.sql'],
        appliedMigrations: ['001_initial.sql'],
        pendingMigrations: ['002_access.sql']
      };
    }
  });

  assert.equal(result.exitCode, 0);
  assert.match(stdout.join(''), /PostgreSQL smoke check passed/);
  assert.match(stdout.join(''), /Would apply 1 migrations/);
  assert.deepEqual(stderr, []);
  assert.deepEqual(calls, [
    {
      databaseUrl: 'postgres://cloak:secret@127.0.0.1:5432/cloak',
      migrationsDir: undefined,
      config: {
        repository: {
          driver: 'postgres'
        }
      }
    }
  ]);
});

test('runPostgresSmokeCheck writes errors to stderr and returns exitCode 1', async () => {
  const stdout = [];
  const stderr = [];

  const result = await runPostgresSmokeCheck({
    argv: [],
    stdout: { write(message) { stdout.push(message); } },
    stderr: { write(message) { stderr.push(message); } },
    runMigrationStatusCommand: async () => {
      throw new Error('database unavailable');
    }
  });

  assert.equal(result.exitCode, 1);
  assert.deepEqual(stdout, []);
  assert.match(stderr.join(''), /database unavailable/);
});
