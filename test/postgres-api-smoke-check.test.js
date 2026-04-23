import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatPostgresApiSmokeCheckSummary,
  parsePostgresApiSmokeCheckArgs,
  runPostgresApiSmokeCheck
} from '../src/database/run-postgres-api-smoke-check.js';

test('parsePostgresApiSmokeCheckArgs reads database-url and admin-token overrides', () => {
  assert.deepEqual(
    parsePostgresApiSmokeCheckArgs([
      '--database-url',
      'postgres://cloak:secret@127.0.0.1:55432/cloak',
      '--admin-token=secret-token'
    ]),
    {
      databaseUrl: 'postgres://cloak:secret@127.0.0.1:55432/cloak',
      adminToken: 'secret-token',
      checkHealth: false,
      keepCampaign: false,
      help: false
    }
  );
});

test('parsePostgresApiSmokeCheckArgs can enable health probing', () => {
  assert.deepEqual(parsePostgresApiSmokeCheckArgs(['--check-health']), {
    databaseUrl: undefined,
    adminToken: undefined,
    checkHealth: true,
    keepCampaign: false,
    help: false
  });
});

test('parsePostgresApiSmokeCheckArgs can keep the created campaign for manual inspection', () => {
  assert.deepEqual(parsePostgresApiSmokeCheckArgs(['--keep-campaign']), {
    databaseUrl: undefined,
    adminToken: undefined,
    checkHealth: false,
    keepCampaign: true,
    help: false
  });
});

test('formatPostgresApiSmokeCheckSummary includes campaign, redirect, logs, analytics, cleanup, and health when present', () => {
  const summary = formatPostgresApiSmokeCheckSummary({
    campaignId: 'campaign-1',
    redirectStatus: 302,
    logCount: 1,
    totalVisits: 1,
    healthStatus: 200,
    cleanup: 'logs deleted, campaign deleted'
  });

  assert.match(summary, /PostgreSQL API smoke check passed/);
  assert.match(summary, /campaign-1/);
  assert.match(summary, /Redirect status: 302/);
  assert.match(summary, /Log count: 1/);
  assert.match(summary, /Total visits: 1/);
  assert.match(summary, /Health status: 200/);
  assert.match(summary, /Cleanup: logs deleted, campaign deleted/);
});

test('formatPostgresApiSmokeCheckSummary omits health when no probe ran', () => {
  const summary = formatPostgresApiSmokeCheckSummary({
    campaignId: 'campaign-1',
    redirectStatus: 302,
    logCount: 1,
    totalVisits: 1,
    cleanup: 'kept'
  });

  assert.doesNotMatch(summary, /Health status:/);
});

test('runPostgresApiSmokeCheck starts postgres app, exercises APIs, cleans up, and closes server', async () => {
  const calls = [];
  const server = {
    address() {
      return { address: '127.0.0.1', port: 3111 };
    },
    close(callback) {
      calls.push({ type: 'close' });
      callback();
    }
  };

  const result = await runPostgresApiSmokeCheck({
    argv: ['--database-url', 'postgres://cloak:secret@127.0.0.1:55432/cloak'],
    stdout: { write(message) { calls.push({ type: 'stdout', message }); } },
    stderr: { write(message) { calls.push({ type: 'stderr', message }); } },
    startServer: async ({ config }) => {
      calls.push({ type: 'start', config });
      return server;
    },
    fetch: async (url, options = {}) => {
      calls.push({ type: 'fetch', url, options });

      if (url.endsWith('/api/v1/campaigns')) {
        return jsonResponse(201, {
          success: true,
          data: {
            id: 'campaign-1',
            name: 'Postgres Smoke Campaign'
          }
        });
      }

      if (url.endsWith('/c/campaign-1')) {
        return {
          status: 302,
          headers: new Headers({ location: 'https://money.example/smoke' }),
          json: async () => ({})
        };
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
          data: {
            totalVisits: 1
          }
        });
      }

      if (url.endsWith('/api/v1/campaigns/campaign-1/logs') && options.method === 'DELETE') {
        return jsonResponse(200, {
          success: true,
          data: { campaignId: 'campaign-1', deleted: 1 }
        });
      }

      if (url.endsWith('/api/v1/campaigns/campaign-1') && options.method === 'DELETE') {
        return jsonResponse(200, {
          success: true,
          data: { id: 'campaign-1' }
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    }
  });

  assert.equal(result.exitCode, 0);
  assert.equal(calls[0].type, 'start');
  assert.equal(calls.at(-1).type, 'close');
  assert.ok(calls.some((call) => call.type === 'fetch' && call.url.endsWith('/api/v1/campaigns/campaign-1/logs') && call.options.method === 'DELETE'));
  assert.ok(calls.some((call) => call.type === 'fetch' && call.url.endsWith('/api/v1/campaigns/campaign-1') && call.options.method === 'DELETE'));
  assert.ok(calls.some((call) => call.type === 'stdout' && call.message.includes('PostgreSQL API smoke check passed')));
});

test('runPostgresApiSmokeCheck can probe health when --check-health is present', async () => {
  const calls = [];
  const server = {
    address() {
      return { address: '127.0.0.1', port: 3111 };
    },
    close(callback) {
      calls.push({ type: 'close' });
      callback();
    }
  };

  const result = await runPostgresApiSmokeCheck({
    argv: ['--check-health'],
    stdout: { write(message) { calls.push({ type: 'stdout', message }); } },
    stderr: { write(message) { calls.push({ type: 'stderr', message }); } },
    startServer: async () => server,
    fetch: async (url, options = {}) => {
      calls.push({ type: 'fetch', url, options });

      if (url.endsWith('/health')) {
        return jsonResponse(200, {
          success: true,
          data: { status: 'ok', version: '0.1.0', uptimeSeconds: 0 },
          message: 'ok'
        });
      }

      if (url.endsWith('/api/v1/campaigns') && options.method === 'POST') {
        return jsonResponse(201, {
          success: true,
          data: {
            id: 'campaign-1',
            name: 'Postgres Smoke Campaign'
          }
        });
      }

      if (url.endsWith('/c/campaign-1')) {
        return {
          status: 302,
          headers: new Headers({ location: 'https://money.example/smoke' }),
          json: async () => ({})
        };
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
          data: {
            totalVisits: 1
          }
        });
      }

      if (url.endsWith('/api/v1/campaigns/campaign-1/logs') && options.method === 'DELETE') {
        return jsonResponse(200, {
          success: true,
          data: { campaignId: 'campaign-1', deleted: 1 }
        });
      }

      if (url.endsWith('/api/v1/campaigns/campaign-1') && options.method === 'DELETE') {
        return jsonResponse(200, {
          success: true,
          data: { id: 'campaign-1' }
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    }
  });

  assert.equal(result.exitCode, 0);
  assert.ok(calls.some((call) => call.type === 'fetch' && call.url.endsWith('/health')));
  assert.ok(calls.some((call) => call.type === 'stdout' && call.message.includes('Health status: 200')));
});

test('runPostgresApiSmokeCheck skips cleanup when --keep-campaign is present', async () => {
  const calls = [];
  const server = {
    address() {
      return { address: '127.0.0.1', port: 3111 };
    },
    close(callback) {
      calls.push({ type: 'close' });
      callback();
    }
  };

  const result = await runPostgresApiSmokeCheck({
    argv: ['--keep-campaign'],
    stdout: { write(message) { calls.push({ type: 'stdout', message }); } },
    stderr: { write(message) { calls.push({ type: 'stderr', message }); } },
    startServer: async () => server,
    fetch: async (url, options = {}) => {
      calls.push({ type: 'fetch', url, options });

      if (url.endsWith('/api/v1/campaigns') && options.method === 'POST') {
        return jsonResponse(201, {
          success: true,
          data: {
            id: 'campaign-1',
            name: 'Postgres Smoke Campaign'
          }
        });
      }

      if (url.endsWith('/c/campaign-1')) {
        return {
          status: 302,
          headers: new Headers({ location: 'https://money.example/smoke' }),
          json: async () => ({})
        };
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
          data: {
            totalVisits: 1
          }
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    }
  });

  assert.equal(result.exitCode, 0);
  assert.ok(!calls.some((call) => call.type === 'fetch' && call.options.method === 'DELETE'));
  assert.ok(calls.some((call) => call.type === 'stdout' && call.message.includes('Cleanup: kept')));
});

test('runPostgresApiSmokeCheck closes server and reports errors when a request fails', async () => {
  const calls = [];
  const server = {
    address() {
      return { address: '127.0.0.1', port: 3111 };
    },
    close(callback) {
      calls.push('close');
      callback();
    }
  };

  const result = await runPostgresApiSmokeCheck({
    argv: ['--database-url', 'postgres://cloak:secret@127.0.0.1:55432/cloak'],
    stdout: { write() {} },
    stderr: { write(message) { calls.push(message); } },
    startServer: async () => server,
    fetch: async () => jsonResponse(500, {
      success: false,
      error: { message: 'boom' }
    })
  });

  assert.equal(result.exitCode, 1);
  assert.ok(calls.includes('close'));
  assert.ok(calls.some((message) => message.includes('HTTP 500')));
});

function jsonResponse(status, body) {
  return {
    status,
    headers: new Headers(),
    json: async () => body
  };
}
