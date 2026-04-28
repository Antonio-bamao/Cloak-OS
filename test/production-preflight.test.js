import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatProductionPreflightHelp,
  formatProductionPreflightSummary,
  parseProductionPreflightArgs,
  runProductionPreflight
} from '../src/database/run-production-preflight.js';

test('parseProductionPreflightArgs reads database, token, and migration overrides', () => {
  assert.deepEqual(
    parseProductionPreflightArgs([
      '--database-url',
      'postgres://cloak:secret@127.0.0.1:55432/cloak',
      '--admin-token=secret-token',
      '--migrations-dir',
      'custom-migrations'
    ]),
    {
      databaseUrl: 'postgres://cloak:secret@127.0.0.1:55432/cloak',
      adminToken: 'secret-token',
      migrationsDir: 'custom-migrations',
      help: false
    }
  );
});

test('formatProductionPreflightHelp documents the preflight command', () => {
  const help = formatProductionPreflightHelp();

  assert.match(help, /PostgreSQL Production Preflight CLI/);
  assert.match(help, /--database-url/);
  assert.match(help, /--admin-token/);
  assert.match(help, /--migrations-dir/);
});

test('formatProductionPreflightSummary includes migration, health, routing, and cleanup evidence', () => {
  const summary = formatProductionPreflightSummary({
    pendingMigrationCount: 0,
    healthStatus: 200,
    settingsRepository: 'postgres',
    adminPageStatus: 200,
    botRedirectStatus: 302,
    botRedirectLocation: 'https://white.example/preflight',
    humanRedirectStatus: 302,
    humanRedirectLocation: 'https://black.example/preflight',
    campaignLogCount: 2,
    cleanup: 'logs deleted, campaign deleted'
  });

  assert.match(summary, /PostgreSQL production preflight passed/);
  assert.match(summary, /Pending migrations: 0/);
  assert.match(summary, /Health status: 200/);
  assert.match(summary, /Settings repository: postgres/);
  assert.match(summary, /Admin page status: 200/);
  assert.match(summary, /Bot redirect: 302 -> https:\/\/white\.example\/preflight/);
  assert.match(summary, /Human redirect: 302 -> https:\/\/black\.example\/preflight/);
  assert.match(summary, /Campaign log count: 2/);
  assert.match(summary, /Cleanup: logs deleted, campaign deleted/);
});

test('runProductionPreflight verifies postgres runtime, routing, logs, and cleanup', async () => {
  const calls = [];
  const server = createFakeServer(3111, calls);

  const result = await runProductionPreflight({
    argv: [
      '--database-url',
      'postgres://cloak:secret@127.0.0.1:55432/cloak',
      '--admin-token',
      'secret-token'
    ],
    stdout: { write(message) { calls.push({ type: 'stdout', message }); } },
    stderr: { write(message) { calls.push({ type: 'stderr', message }); } },
    runMigrationStatusCommand: async (options) => {
      calls.push({ type: 'migration-status', options });
      return {
        allMigrations: ['001_initial.sql'],
        appliedMigrations: ['001_initial.sql'],
        pendingMigrations: []
      };
    },
    startServer: async ({ config }) => {
      calls.push({ type: 'start', config });
      return server;
    },
    fetch: createPreflightFetch(calls)
  });

  assert.equal(result.exitCode, 0);
  assert.ok(calls.some((call) => call.type === 'migration-status' && call.options.databaseUrl.includes('cloak')));
  assert.ok(calls.some((call) => call.type === 'start' && call.config.repository.driver === 'postgres'));
  assert.ok(calls.some((call) => call.type === 'fetch' && call.url.endsWith('/health')));
  assert.ok(calls.some((call) => call.type === 'fetch' && call.url.endsWith('/admin')));
  assert.ok(calls.some((call) => call.type === 'fetch' && call.url.endsWith('/c/campaign-1') && call.options.headers['user-agent'].includes('Googlebot')));
  assert.ok(calls.some((call) => call.type === 'fetch' && call.url.endsWith('/c/campaign-1') && call.options.headers['user-agent'].includes('Chrome')));
  assert.ok(calls.some((call) => call.type === 'fetch' && call.url.endsWith('/api/v1/campaigns/campaign-1/logs') && call.options.method === 'DELETE'));
  assert.ok(calls.some((call) => call.type === 'fetch' && call.url.endsWith('/api/v1/campaigns/campaign-1') && call.options.method === 'DELETE'));
  assert.equal(calls.at(-1).type, 'close');
  assert.ok(calls.some((call) => call.type === 'stdout' && call.message.includes('PostgreSQL production preflight passed')));
});

test('runProductionPreflight fails before startup when migrations are pending', async () => {
  const calls = [];
  const result = await runProductionPreflight({
    argv: [],
    stdout: { write(message) { calls.push({ type: 'stdout', message }); } },
    stderr: { write(message) { calls.push({ type: 'stderr', message }); } },
    runMigrationStatusCommand: async () => ({
      allMigrations: ['001_initial.sql', '002_pending.sql'],
      appliedMigrations: ['001_initial.sql'],
      pendingMigrations: ['002_pending.sql']
    }),
    startServer: async () => {
      calls.push({ type: 'start' });
      return createFakeServer(3111, calls);
    }
  });

  assert.equal(result.exitCode, 1);
  assert.ok(!calls.some((call) => call.type === 'start'));
  assert.ok(calls.some((call) => call.type === 'stderr' && call.message.includes('Pending migrations must be applied before preflight')));
});

test('runProductionPreflight cleans up the temporary campaign when a later check fails', async () => {
  const calls = [];
  const server = createFakeServer(3111, calls);
  const result = await runProductionPreflight({
    argv: [],
    stdout: { write(message) { calls.push({ type: 'stdout', message }); } },
    stderr: { write(message) { calls.push({ type: 'stderr', message }); } },
    runMigrationStatusCommand: async () => ({
      allMigrations: ['001_initial.sql'],
      appliedMigrations: ['001_initial.sql'],
      pendingMigrations: []
    }),
    startServer: async () => server,
    fetch: createPreflightFetch(calls, {
      humanLocation: 'https://wrong.example/preflight'
    })
  });

  assert.equal(result.exitCode, 1);
  assert.ok(calls.some((call) => call.type === 'fetch' && call.url.endsWith('/api/v1/campaigns/campaign-1/logs') && call.options.method === 'DELETE'));
  assert.ok(calls.some((call) => call.type === 'fetch' && call.url.endsWith('/api/v1/campaigns/campaign-1') && call.options.method === 'DELETE'));
  assert.equal(calls.at(-1).type, 'close');
  assert.ok(calls.some((call) => call.type === 'stderr' && call.message.includes('human redirect')));
});

function createFakeServer(port, calls) {
  return {
    address() {
      return { address: '127.0.0.1', port };
    },
    close(callback) {
      calls.push({ type: 'close' });
      callback();
    }
  };
}

function createPreflightFetch(calls, {
  botLocation = 'https://white.example/preflight',
  humanLocation = 'https://black.example/preflight'
} = {}) {
  return async (url, options = {}) => {
    calls.push({ type: 'fetch', url, options });

    if (url.endsWith('/health')) {
      return jsonResponse(200, { success: true, data: { status: 'ok' } });
    }

    if (url.endsWith('/api/v1/settings')) {
      return jsonResponse(200, {
        success: true,
        data: {
          repository: { driver: 'postgres', databaseConfigured: true },
          detection: { botIpCount: 0 }
        }
      });
    }

    if (url.endsWith('/admin') || url.endsWith('/admin/styles.css') || url.endsWith('/admin/app.js')) {
      return textResponse(200, 'ok');
    }

    if (url.endsWith('/api/v1/campaigns') && options.method === 'POST') {
      return jsonResponse(201, {
        success: true,
        data: { id: 'campaign-1' }
      });
    }

    if (url.endsWith('/c/campaign-1') && options.headers['user-agent'].includes('Googlebot')) {
      return redirectResponse(302, botLocation);
    }

    if (url.endsWith('/c/campaign-1')) {
      return redirectResponse(302, humanLocation);
    }

    if (url.endsWith('/api/v1/campaigns/campaign-1/logs?pageSize=10')) {
      return jsonResponse(200, {
        success: true,
        data: [{ id: 'log-1' }, { id: 'log-2' }],
        pagination: { total: 2 }
      });
    }

    if (url.endsWith('/api/v1/campaigns/campaign-1/logs') && options.method === 'DELETE') {
      return jsonResponse(200, { success: true, data: { deleted: 2 } });
    }

    if (url.endsWith('/api/v1/campaigns/campaign-1') && options.method === 'DELETE') {
      return jsonResponse(200, { success: true, data: { id: 'campaign-1' } });
    }

    throw new Error(`Unexpected URL: ${url}`);
  };
}

function jsonResponse(status, body) {
  return {
    status,
    headers: new Headers(),
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

function textResponse(status, body) {
  return {
    status,
    headers: new Headers(),
    text: async () => body,
    json: async () => ({})
  };
}

function redirectResponse(status, location) {
  return {
    status,
    headers: new Headers({ location }),
    json: async () => ({}),
    text: async () => ''
  };
}
