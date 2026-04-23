import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

import { getConfig, validateConfig } from '../src/config/index.js';
import { isDirectRun, startServer } from '../src/server/start.js';

test('getConfig reads host and port from an injected env object', () => {
  const config = getConfig({
    HOST: '127.0.0.1',
    PORT: '4321',
    MIN_CONFIDENCE: '55',
    BOT_CONFIDENCE: '88',
    BOT_IPS: '66.249.66.1, 66.249.66.2,,',
    REPOSITORY_DRIVER: 'postgres',
    DATABASE_URL: 'postgres://cloak:secret@127.0.0.1:5432/cloak',
    ADMIN_TOKEN: 'dev-admin-token'
  });

  assert.deepEqual(config.server, {
    host: '127.0.0.1',
    port: 4321
  });
  assert.deepEqual(config.detection, {
    suspiciousThreshold: 55,
    botThreshold: 88,
    botIps: ['66.249.66.1', '66.249.66.2']
  });
  assert.deepEqual(config.auth, {
    adminToken: 'dev-admin-token'
  });
  assert.deepEqual(config.repository, {
    driver: 'postgres',
    databaseUrl: 'postgres://cloak:secret@127.0.0.1:5432/cloak'
  });
});

test('startServer listens using configured host and port and logs startup', async () => {
  const entries = [];
  const logger = {
    info(message, context) {
      entries.push({ level: 'info', message, ...context });
    }
  };

  const server = await startServer({
    config: { server: { host: '127.0.0.1', port: 0 } },
    logger
  });

  try {
    const address = server.address();

    assert.equal(address.address, '127.0.0.1');
    assert.ok(address.port > 0);
    assert.deepEqual(entries, [
      {
        level: 'info',
        message: 'HTTP server started',
        host: '127.0.0.1',
        port: address.port
      }
    ]);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('validateConfig rejects invalid runtime values before startup', () => {
  assert.throws(
    () => validateConfig({
      server: { host: '', port: Number.NaN },
      detection: {
        suspiciousThreshold: 0,
        botThreshold: 120,
        botIps: []
      },
      repository: {
        driver: 'sqlite',
        databaseUrl: ''
      }
    }),
    (error) => {
      assert.equal(error.errorCode, 'CONFIG_INVALID');
      assert.match(error.message, /server.host/);
      assert.match(error.message, /server.port/);
      assert.match(error.message, /detection.suspiciousThreshold/);
      assert.match(error.message, /detection.botThreshold/);
      assert.match(error.message, /repository.driver/);
      return true;
    }
  );
});

test('startServer validates config before creating the app', async () => {
  let appCreated = false;

  await assert.rejects(
    () => startServer({
      config: {
        server: { host: '', port: Number.NaN },
        detection: {
          suspiciousThreshold: 60,
          botThreshold: 80,
          botIps: []
        },
        repository: {
          driver: 'memory',
          databaseUrl: ''
        }
      },
      createApp: () => {
        appCreated = true;
      }
    }),
    /server.host/
  );

  assert.equal(appCreated, false);
});

test('validateConfig requires databaseUrl when repository driver is postgres', () => {
  assert.throws(
    () => validateConfig({
      server: { host: '127.0.0.1', port: 3000 },
      detection: {
        suspiciousThreshold: 60,
        botThreshold: 80,
        botIps: []
      },
      auth: {
        adminToken: 'dev-admin-token'
      },
      repository: {
        driver: 'postgres',
        databaseUrl: ''
      }
    }),
    /repository.databaseUrl/
  );
});

test('startServer creates and passes a postgres client when postgres repository mode is enabled', async () => {
  const postgresClient = { query() {} };
  const calls = [];
  const server = await startServer({
    config: {
      server: { host: '127.0.0.1', port: 0 },
      repository: {
        driver: 'postgres',
        databaseUrl: 'postgres://cloak:secret@127.0.0.1:5432/cloak'
      }
    },
    createPostgresClient: async (databaseUrl) => {
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

test('startServer uses the built-in postgres client factory when postgres mode is enabled', async () => {
  const postgresClient = {
    query() {},
    async end() {}
  };
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

test('isDirectRun compares file URLs and filesystem paths safely', () => {
  const entryPath = 'C:\\Users\\m1591\\Desktop\\斗篷cloak\\src\\server\\start.js';

  assert.equal(isDirectRun(pathToFileURL(entryPath).href, entryPath), true);
  assert.equal(isDirectRun(pathToFileURL(entryPath).href, 'C:\\other\\start.js'), false);
});

function createFakeServer() {
  const listeners = new Map();

  return {
    once(event, handler) {
      listeners.set(event, handler);
    },
    listen(port, host, callback) {
      this._address = { address: host, port: port || 3100 };
      callback();
    },
    address() {
      return this._address;
    },
    close(callback) {
      callback();
    }
  };
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
