import test from 'node:test';
import assert from 'node:assert/strict';

import { runMigrations } from '../src/database/migration-runner.js';

test('runMigrations applies pending SQL files in sorted order and records them', async () => {
  const calls = [];
  const session = {
    async query(sql, params) {
      calls.push({ scope: 'session', sql, params });
      return { rows: [] };
    },
    release() {
      calls.push({ scope: 'session', sql: 'RELEASE' });
    }
  };
  const client = {
    async query(sql) {
      calls.push({ scope: 'client', sql });

      if (sql.includes('SELECT filename FROM schema_migrations')) {
        return { rows: [] };
      }

      return { rows: [] };
    },
    async connect() {
      calls.push({ scope: 'client', sql: 'CONNECT' });
      return session;
    }
  };

  const result = await runMigrations({
    client,
    migrationsDir: 'migrations',
    readdir: async () => ['002_access.sql', '001_initial.sql'],
    readFile: async (filepath) => `-- ${filepath}`
  });

  assert.deepEqual(result, {
    appliedMigrations: ['001_initial.sql', '002_access.sql'],
    skippedMigrations: []
  });

  assert.deepEqual(calls, [
    {
      scope: 'client',
      sql: `CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`
    },
    {
      scope: 'client',
      sql: 'SELECT filename FROM schema_migrations ORDER BY filename ASC;'
    },
    {
      scope: 'client',
      sql: 'CONNECT'
    },
    {
      scope: 'session',
      sql: 'BEGIN',
      params: undefined
    },
    {
      scope: 'session',
      sql: '-- migrations\\001_initial.sql',
      params: undefined
    },
    {
      scope: 'session',
      sql: 'INSERT INTO schema_migrations (filename) VALUES ($1);',
      params: ['001_initial.sql']
    },
    {
      scope: 'session',
      sql: 'COMMIT',
      params: undefined
    },
    {
      scope: 'session',
      sql: 'RELEASE'
    },
    {
      scope: 'client',
      sql: 'CONNECT'
    },
    {
      scope: 'session',
      sql: 'BEGIN',
      params: undefined
    },
    {
      scope: 'session',
      sql: '-- migrations\\002_access.sql',
      params: undefined
    },
    {
      scope: 'session',
      sql: 'INSERT INTO schema_migrations (filename) VALUES ($1);',
      params: ['002_access.sql']
    },
    {
      scope: 'session',
      sql: 'COMMIT',
      params: undefined
    },
    {
      scope: 'session',
      sql: 'RELEASE'
    }
  ]);
});

test('runMigrations skips files already recorded in schema_migrations', async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });

      if (sql.includes('SELECT filename FROM schema_migrations')) {
        return {
          rows: [{ filename: '001_initial.sql' }]
        };
      }

      return { rows: [] };
    }
  };

  const result = await runMigrations({
    client,
    migrationsDir: 'migrations',
    readdir: async () => ['001_initial.sql', '002_access.sql'],
    readFile: async (filepath) => `-- ${filepath}`
  });

  assert.deepEqual(result, {
    appliedMigrations: ['002_access.sql'],
    skippedMigrations: ['001_initial.sql']
  });
  assert.equal(
    calls.some((entry) => entry.sql === '-- migrations\\001_initial.sql'),
    false
  );
});

test('runMigrations rolls back and releases the session when a migration fails', async () => {
  const calls = [];
  const failure = new Error('bad sql');
  const session = {
    async query(sql, params) {
      calls.push({ scope: 'session', sql, params });

      if (sql === '-- migrations\\001_initial.sql') {
        throw failure;
      }

      return { rows: [] };
    },
    release() {
      calls.push({ scope: 'session', sql: 'RELEASE' });
    }
  };
  const client = {
    async query(sql) {
      calls.push({ scope: 'client', sql });

      if (sql.includes('SELECT filename FROM schema_migrations')) {
        return { rows: [] };
      }

      return { rows: [] };
    },
    async connect() {
      calls.push({ scope: 'client', sql: 'CONNECT' });
      return session;
    }
  };

  await assert.rejects(
    () =>
      runMigrations({
        client,
        migrationsDir: 'migrations',
        readdir: async () => ['001_initial.sql'],
        readFile: async (filepath) => `-- ${filepath}`
      }),
    failure
  );

  assert.deepEqual(calls, [
    {
      scope: 'client',
      sql: `CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`
    },
    {
      scope: 'client',
      sql: 'SELECT filename FROM schema_migrations ORDER BY filename ASC;'
    },
    {
      scope: 'client',
      sql: 'CONNECT'
    },
    {
      scope: 'session',
      sql: 'BEGIN',
      params: undefined
    },
    {
      scope: 'session',
      sql: '-- migrations\\001_initial.sql',
      params: undefined
    },
    {
      scope: 'session',
      sql: 'ROLLBACK',
      params: undefined
    },
    {
      scope: 'session',
      sql: 'RELEASE'
    }
  ]);
});
