import test from 'node:test';
import assert from 'node:assert/strict';

import { createApp } from '../src/server/app.js';

const AUTH_HEADERS = { Authorization: 'Bearer dev-admin-token' };

test('settings API returns protected runtime settings summary without secrets', async () => {
  const app = createApp({
    readBotIpFile: () => '203.0.113.10\n203.0.113.11\n',
    postgresClient: {
      async query() {
        return { rows: [], rowCount: 0 };
      }
    },
    config: {
      server: {
        host: '127.0.0.1',
        port: 3100
      },
      detection: {
        suspiciousThreshold: 55,
        botThreshold: 85,
        botIps: ['203.0.113.10', '203.0.113.11'],
        botIpSource: {
          type: 'file',
          filePath: '/app/config/bot-ips.txt'
        }
      },
      auth: {
        adminToken: 'super-secret-token'
      },
      repository: {
        driver: 'postgres',
        databaseUrl: 'postgres://cloak:secret@db:5432/cloak'
      }
    }
  });

  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = app.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/settings`, {
      headers: { Authorization: 'Bearer super-secret-token' }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      data: {
        server: {
          host: '127.0.0.1',
          port: 3100
        },
        detection: {
          suspiciousThreshold: 55,
          botThreshold: 85,
          botIpCount: 2,
          botIps: ['203.0.113.10', '203.0.113.11'],
          botIpSource: {
            type: 'file',
            filePath: '/app/config/bot-ips.txt'
          }
        },
        repository: {
          driver: 'postgres',
          databaseConfigured: true
        },
        auth: {
          adminTokenConfigured: true
        },
        notes: [
          '系统设置来自环境变量；文件型 Bot IP 名单可通过重载接口刷新。',
          'ADMIN_TOKEN 和 DATABASE_URL 不会在管理 API 中返回明文。'
        ]
      },
      message: 'Settings fetched'
    });
  } finally {
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('settings API rejects missing admin authorization', async () => {
  const app = createApp();

  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = app.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/settings`);

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required'
      }
    });
  } finally {
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('settings API reports and reloads the active file bot IP source', async () => {
  let fileContent = '66.249.66.1\n';
  const app = createApp({
    readBotIpFile: () => fileContent,
    config: {
      server: {
        host: '127.0.0.1',
        port: 3100
      },
      detection: {
        suspiciousThreshold: 55,
        botThreshold: 85,
        botIps: [],
        botIpSource: {
          type: 'file',
          filePath: '/app/config/bot-ips.txt'
        }
      },
      auth: {
        adminToken: 'super-secret-token'
      },
      repository: {
        driver: 'memory',
        databaseUrl: ''
      }
    }
  });

  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = app.address();
    const settingsBefore = await fetch(`http://127.0.0.1:${port}/api/v1/settings`, {
      headers: { Authorization: 'Bearer super-secret-token' }
    });

    assert.equal(settingsBefore.status, 200);
    assert.deepEqual((await settingsBefore.json()).data.detection.botIps, ['66.249.66.1']);

    fileContent = '203.0.113.10\n203.0.113.11\n';
    const reloadResponse = await fetch(`http://127.0.0.1:${port}/api/v1/settings/bot-ips/reload`, {
      method: 'POST',
      headers: { Authorization: 'Bearer super-secret-token' }
    });

    assert.equal(reloadResponse.status, 200);
    assert.deepEqual(await reloadResponse.json(), {
      success: true,
      data: {
        botIpCount: 2,
        botIps: ['203.0.113.10', '203.0.113.11'],
        botIpSource: {
          type: 'file',
          filePath: '/app/config/bot-ips.txt'
        }
      },
      message: 'Bot IP source reloaded'
    });

    const settingsAfter = await fetch(`http://127.0.0.1:${port}/api/v1/settings`, {
      headers: { Authorization: 'Bearer super-secret-token' }
    });

    assert.equal(settingsAfter.status, 200);
    assert.deepEqual((await settingsAfter.json()).data.detection.botIps, [
      '203.0.113.10',
      '203.0.113.11'
    ]);
  } finally {
    await new Promise((resolve, reject) => {
      app.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
