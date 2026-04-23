import test from 'node:test';
import assert from 'node:assert/strict';

import { createPostgresClientFactory } from '../src/infrastructure/postgres/create-postgres-client.js';

test('createPostgresClientFactory creates a pg Pool with the provided databaseUrl and verifies connectivity', async () => {
  const calls = [];
  const factory = createPostgresClientFactory({
    Pool: class FakePool {
      constructor(options) {
        calls.push({ type: 'constructor', options });
      }

      async query(sql, params) {
        calls.push({ type: 'query', sql, params });
        return { rows: [] };
      }

      async end() {
        calls.push({ type: 'end' });
      }
    }
  });

  const client = await factory('postgres://cloak:secret@127.0.0.1:5432/cloak');

  assert.equal(typeof client.query, 'function');
  assert.equal(typeof client.end, 'function');
  assert.deepEqual(calls, [
    {
      type: 'constructor',
      options: {
        connectionString: 'postgres://cloak:secret@127.0.0.1:5432/cloak'
      }
    },
    {
      type: 'query',
      sql: 'SELECT 1',
      params: undefined
    }
  ]);
});
