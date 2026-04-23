import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatMigrationSummary,
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
