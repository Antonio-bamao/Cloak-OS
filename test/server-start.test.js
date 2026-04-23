import test from 'node:test';
import assert from 'node:assert/strict';

import { getConfig } from '../src/config/index.js';
import { startServer } from '../src/server/start.js';

test('getConfig reads host and port from an injected env object', () => {
  const config = getConfig({
    HOST: '127.0.0.1',
    PORT: '4321',
    MIN_CONFIDENCE: '55',
    BOT_CONFIDENCE: '88'
  });

  assert.deepEqual(config.server, {
    host: '127.0.0.1',
    port: 4321
  });
  assert.deepEqual(config.detection, {
    suspiciousThreshold: 55,
    botThreshold: 88
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
