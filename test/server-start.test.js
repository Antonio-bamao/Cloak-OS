import test from 'node:test';
import assert from 'node:assert/strict';

import { getConfig, validateConfig } from '../src/config/index.js';
import { startServer } from '../src/server/start.js';

test('getConfig reads host and port from an injected env object', () => {
  const config = getConfig({
    HOST: '127.0.0.1',
    PORT: '4321',
    MIN_CONFIDENCE: '55',
    BOT_CONFIDENCE: '88',
    BOT_IPS: '66.249.66.1, 66.249.66.2,,'
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
      }
    }),
    (error) => {
      assert.equal(error.errorCode, 'CONFIG_INVALID');
      assert.match(error.message, /server.host/);
      assert.match(error.message, /server.port/);
      assert.match(error.message, /detection.suspiciousThreshold/);
      assert.match(error.message, /detection.botThreshold/);
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
