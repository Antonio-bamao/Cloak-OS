import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatPostgresAdminSmokeCheckHelp,
  formatPostgresAdminSmokeCheckSummary,
  parsePostgresAdminSmokeCheckArgs,
  runPostgresAdminSmokeCheck
} from '../src/database/run-postgres-admin-smoke-check.js';

test('parsePostgresAdminSmokeCheckArgs reads database-url and admin-token overrides', () => {
  assert.deepEqual(
    parsePostgresAdminSmokeCheckArgs([
      '--database-url',
      'postgres://cloak:secret@127.0.0.1:55432/cloak',
      '--admin-token=secret-token'
    ]),
    {
      databaseUrl: 'postgres://cloak:secret@127.0.0.1:55432/cloak',
      adminToken: 'secret-token',
      help: false
    }
  );
});

test('formatPostgresAdminSmokeCheckSummary includes page, campaigns, logs, and analytics counts', () => {
  const summary = formatPostgresAdminSmokeCheckSummary({
    pageStatus: 200,
    campaignCount: 2,
    logCount: 3,
    totalVisits: 3
  });

  assert.match(summary, /PostgreSQL admin smoke check passed/);
  assert.match(summary, /Admin page status: 200/);
  assert.match(summary, /Campaign count: 2/);
  assert.match(summary, /Log count: 3/);
  assert.match(summary, /Total visits: 3/);
});

test('formatPostgresAdminSmokeCheckHelp documents postgres admin smoke behavior', () => {
  const help = formatPostgresAdminSmokeCheckHelp();

  assert.match(help, /Admin Smoke Check/i);
  assert.match(help, /--database-url/);
  assert.match(help, /--admin-token/);
});

test('runPostgresAdminSmokeCheck validates admin assets and management APIs then closes server', async () => {
  const calls = [];
  const server = {
    address() {
      return { address: '127.0.0.1', port: 3222 };
    },
    close(callback) {
      calls.push({ type: 'close' });
      callback();
    }
  };

  const result = await runPostgresAdminSmokeCheck({
    argv: ['--database-url', 'postgres://cloak:secret@127.0.0.1:55432/cloak'],
    stdout: { write(message) { calls.push({ type: 'stdout', message }); } },
    stderr: { write(message) { calls.push({ type: 'stderr', message }); } },
    startServer: async ({ config }) => {
      calls.push({ type: 'start', config });
      return server;
    },
    fetch: async (url, options = {}) => {
      calls.push({ type: 'fetch', url, options });

      if (url.endsWith('/admin')) {
        return textResponse(200, '<div id="app-shell"></div><link href="/admin/styles.css"><script src="/admin/app.js"></script>');
      }

      if (url.endsWith('/admin/styles.css')) {
        return textResponse(200, ':root { --color-primary: #000; }');
      }

      if (url.endsWith('/admin/app.js')) {
        return textResponse(200, 'loadOverview(); loadCampaigns(); loadLogs();');
      }

      if (url.endsWith('/api/v1/campaigns')) {
        return jsonResponse(200, {
          success: true,
          data: [{ id: 'campaign-1' }]
        });
      }

      if (url.includes('/api/v1/logs')) {
        return jsonResponse(200, {
          success: true,
          data: [{ id: 'log-1' }],
          pagination: { total: 1 }
        });
      }

      if (url.endsWith('/api/v1/analytics/overview')) {
        return jsonResponse(200, {
          success: true,
          data: { totalVisits: 1 }
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    }
  });

  assert.equal(result.exitCode, 0);
  assert.ok(calls.some((call) => call.type === 'stdout' && call.message.includes('PostgreSQL admin smoke check passed')));
  assert.equal(calls.at(-1).type, 'close');
});

test('runPostgresAdminSmokeCheck closes server and reports errors', async () => {
  const calls = [];
  const server = {
    address() {
      return { address: '127.0.0.1', port: 3222 };
    },
    close(callback) {
      calls.push('close');
      callback();
    }
  };

  const result = await runPostgresAdminSmokeCheck({
    argv: ['--database-url', 'postgres://cloak:secret@127.0.0.1:55432/cloak'],
    stdout: { write() {} },
    stderr: { write(message) { calls.push(message); } },
    startServer: async () => server,
    fetch: async () => textResponse(500, 'boom')
  });

  assert.equal(result.exitCode, 1);
  assert.ok(calls.includes('close'));
  assert.ok(calls.some((message) => message.includes('HTTP 500')));
});

function textResponse(status, text) {
  return {
    status,
    headers: new Headers(),
    text: async () => text,
    json: async () => ({})
  };
}

function jsonResponse(status, body) {
  return {
    status,
    headers: new Headers(),
    text: async () => JSON.stringify(body),
    json: async () => body
  };
}
