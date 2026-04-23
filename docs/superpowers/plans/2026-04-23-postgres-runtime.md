# PostgreSQL Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the service boot in `postgres` mode using the official `pg` driver and an internally created connection pool, while preserving the existing repository boundary.

**Architecture:** Keep PostgreSQL driver usage isolated to a new infrastructure factory and the startup entrypoint. `startServer()` will resolve an internal `pg.Pool` only when needed, verify connectivity before listening, and release internally created pools when the HTTP server closes.

**Tech Stack:** Node.js ESM, `node --test`, official `pg` driver, existing repository factory and startup wiring

---

### Task 1: Add failing tests for internal PostgreSQL client factory

**Files:**
- Create: `test/create-postgres-client.test.js`
- Test: `test/create-postgres-client.test.js`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/create-postgres-client.test.js`
Expected: FAIL with module-not-found or missing export for `createPostgresClientFactory`

- [ ] **Step 3: Write minimal implementation**

```js
import pg from 'pg';

const { Pool } = pg;

export function createPostgresClientFactory({ Pool: PoolClass = Pool } = {}) {
  return async function createPostgresClient(databaseUrl) {
    const pool = new PoolClass({
      connectionString: databaseUrl
    });

    await pool.query('SELECT 1');
    return pool;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/create-postgres-client.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add test/create-postgres-client.test.js src/infrastructure/postgres/create-postgres-client.js
git commit -m "test: add postgres client factory coverage"
```

### Task 2: Add failing tests for default startup wiring in postgres mode

**Files:**
- Modify: `test/server-start.test.js`
- Test: `test/server-start.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('startServer uses the built-in postgres client factory when postgres mode is enabled', async () => {
  const postgresClient = { query() {}, end() {} };
  const calls = [];

  const server = await startServer({
    config: {
      server: { host: '127.0.0.1', port: 0 },
      repository: {
        driver: 'postgres',
        databaseUrl: 'postgres://cloak:secret@127.0.0.1:5432/cloak'
      }
    },
    createDefaultPostgresClient: async (databaseUrl) => {
      calls.push({ type: 'client', databaseUrl });
      return postgresClient;
    },
    createApp: ({ postgresClient: receivedClient }) => {
      calls.push({ type: 'app', postgresClient: receivedClient });
      return createFakeServer();
    }
  });

  try {
    assert.deepEqual(calls, [
      {
        type: 'client',
        databaseUrl: 'postgres://cloak:secret@127.0.0.1:5432/cloak'
      },
      {
        type: 'app',
        postgresClient
      }
    ]);
  } finally {
    await closeServer(server);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/server-start.test.js`
Expected: FAIL because `startServer()` ignores `createDefaultPostgresClient`

- [ ] **Step 3: Write minimal implementation**

```js
import { createPostgresClientFactory } from '../infrastructure/postgres/create-postgres-client.js';

const defaultCreatePostgresClient = createPostgresClientFactory();

export async function startServer({
  createDefaultPostgresClient = defaultCreatePostgresClient,
  ...
} = {}) {
  ...
}

async function resolvePostgresClient({
  config,
  postgresClient,
  createPostgresClient,
  createDefaultPostgresClient
}) {
  if (config.repository?.driver !== 'postgres') {
    return { postgresClient, shouldDispose: false };
  }

  if (postgresClient) {
    return { postgresClient, shouldDispose: false };
  }

  if (createPostgresClient) {
    return {
      postgresClient: await createPostgresClient(config.repository.databaseUrl),
      shouldDispose: false
    };
  }

  return {
    postgresClient: await createDefaultPostgresClient(config.repository.databaseUrl),
    shouldDispose: true
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/server-start.test.js`
Expected: PASS for the new startup wiring test

- [ ] **Step 5: Commit**

```bash
git add test/server-start.test.js src/server/start.js
git commit -m "feat: wire default postgres client startup"
```

### Task 3: Add failing tests for postgres client lifecycle ownership

**Files:**
- Modify: `test/server-start.test.js`
- Test: `test/server-start.test.js`

- [ ] **Step 1: Write the failing tests**

```js
test('startServer closes an internally created postgres client when the server closes', async () => {
  const calls = [];
  const postgresClient = {
    query() {},
    async end() {
      calls.push('end');
    }
  };

  const server = await startServer({
    config: {
      server: { host: '127.0.0.1', port: 0 },
      repository: {
        driver: 'postgres',
        databaseUrl: 'postgres://cloak:secret@127.0.0.1:5432/cloak'
      }
    },
    createDefaultPostgresClient: async () => postgresClient,
    createApp: () => createFakeServer()
  });

  await closeServer(server);

  assert.deepEqual(calls, ['end']);
});

test('startServer does not close an injected postgres client when the server closes', async () => {
  const calls = [];
  const postgresClient = {
    query() {},
    async end() {
      calls.push('end');
    }
  };

  const server = await startServer({
    config: {
      server: { host: '127.0.0.1', port: 0 },
      repository: {
        driver: 'postgres',
        databaseUrl: 'postgres://cloak:secret@127.0.0.1:5432/cloak'
      }
    },
    postgresClient,
    createApp: () => createFakeServer()
  });

  await closeServer(server);

  assert.deepEqual(calls, []);
});
```

- [ ] **Step 2: Run test to verify they fail**

Run: `node --test test/server-start.test.js`
Expected: FAIL because `server.close()` does not yet dispose internally owned postgres clients

- [ ] **Step 3: Write minimal implementation**

```js
function attachServerDisposer(server, { postgresClient, shouldDispose }) {
  if (!shouldDispose || !postgresClient?.end) {
    return server;
  }

  const originalClose = server.close.bind(server);

  server.close = (callback) => {
    originalClose(async (error) => {
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
```

- [ ] **Step 4: Run test to verify they pass**

Run: `node --test test/server-start.test.js`
Expected: PASS for both lifecycle tests

- [ ] **Step 5: Commit**

```bash
git add test/server-start.test.js src/server/start.js
git commit -m "feat: dispose internal postgres clients on shutdown"
```

### Task 4: Add failing docs tests and update runtime docs

**Files:**
- Modify: `test/docs.test.js`
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `package.json`
- Test: `test/docs.test.js`

- [ ] **Step 1: Write the failing test**

```js
test('README documents built-in postgres runtime support', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

  assert.match(readme, /pg/);
  assert.match(readme, /REPOSITORY_DRIVER=postgres/);
  assert.match(readme, /DATABASE_URL/);
  assert.match(readme, /连接池|Pool/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/docs.test.js`
Expected: FAIL because the docs still say postgres mode requires external injection

- [ ] **Step 3: Write minimal implementation**

```json
{
  "dependencies": {
    "pg": "^8.16.0"
  }
}
```

```text
REPOSITORY_DRIVER=memory
DATABASE_URL=postgres://cloak:secret@127.0.0.1:5432/cloak
```

```md
- 项目已内置官方 `pg` 驱动。
- `REPOSITORY_DRIVER=postgres` 时，服务会根据 `DATABASE_URL` 自动创建 PostgreSQL 连接池。
- 启动前会先执行数据库连通性校验，失败则不会监听 HTTP 端口。
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/docs.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add test/docs.test.js README.md .env.example package.json
git commit -m "docs: document built-in postgres runtime support"
```

### Task 5: Run project verification

**Files:**
- Modify: `.context/work-log.md`
- Modify: `.context/current-status.md`

- [ ] **Step 1: Run targeted tests**

```bash
node --test test/create-postgres-client.test.js test/server-start.test.js test/docs.test.js
```

- [ ] **Step 2: Run full test suite**

```bash
node --test
```

- [ ] **Step 3: Update project context**

```text
Record the new pg runtime support, verification commands, and next step in:
- .context/work-log.md
- .context/current-status.md
```

- [ ] **Step 4: Commit**

```bash
git add .context/work-log.md .context/current-status.md
git commit -m "chore: update context after postgres runtime integration"
```
