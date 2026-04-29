import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatProductionMonitorHelp,
  formatProductionMonitorSummary,
  parseProductionMonitorArgs,
  runProductionMonitor
} from '../src/ops/run-production-monitor.js';

test('parseProductionMonitorArgs reads monitor overrides', () => {
  assert.deepEqual(
    parseProductionMonitorArgs([
      '--base-url',
      'https://cloak.example.com',
      '--admin-token=secret-token',
      '--expect-repository',
      'postgres',
      '--check-analytics',
      '--max-bot-percent',
      '80',
      '--max-suspicious-percent=15',
      '--alert-webhook-url',
      'https://alerts.example/webhook'
    ]),
    {
      baseUrl: 'https://cloak.example.com',
      adminToken: 'secret-token',
      expectRepository: 'postgres',
      checkAnalytics: true,
      maxBotPercent: 80,
      maxSuspiciousPercent: 15,
      alertWebhookUrl: 'https://alerts.example/webhook',
      help: false
    }
  );
});

test('formatProductionMonitorHelp documents checks and alert webhook', () => {
  const help = formatProductionMonitorHelp();

  assert.match(help, /Production Monitor CLI/);
  assert.match(help, /--base-url/);
  assert.match(help, /--admin-token/);
  assert.match(help, /--expect-repository/);
  assert.match(help, /--check-analytics/);
  assert.match(help, /--max-bot-percent/);
  assert.match(help, /--max-suspicious-percent/);
  assert.match(help, /--alert-webhook-url/);
});

test('formatProductionMonitorSummary includes health, settings, and analytics evidence', () => {
  const summary = formatProductionMonitorSummary({
    baseUrl: 'https://cloak.example.com',
    healthStatus: 200,
    healthPayloadStatus: 'ok',
    settingsStatus: 200,
    repositoryDriver: 'postgres',
    databaseConfigured: true,
    analyticsStatus: 200,
    totalVisits: 100,
    botPercent: 12,
    suspiciousPercent: 3
  });

  assert.match(summary, /Production monitor check passed/);
  assert.match(summary, /Base URL: https:\/\/cloak\.example\.com/);
  assert.match(summary, /Health: 200 \/ ok/);
  assert.match(summary, /Settings: 200 \/ postgres \/ database configured/);
  assert.match(summary, /Analytics: 200 \/ visits 100 \/ bot 12\.00% \/ suspicious 3\.00%/);
});

test('runProductionMonitor checks health and settings successfully', async () => {
  const calls = [];
  const result = await runProductionMonitor({
    argv: [
      '--base-url',
      'https://cloak.example.com/',
      '--admin-token',
      'secret-token',
      '--expect-repository',
      'postgres'
    ],
    stdout: { write(message) { calls.push({ type: 'stdout', message }); } },
    stderr: { write(message) { calls.push({ type: 'stderr', message }); } },
    fetch: createMonitorFetch(calls)
  });

  assert.equal(result.exitCode, 0);
  assert.ok(calls.some((call) => call.type === 'fetch' && call.url === 'https://cloak.example.com/health'));
  assert.ok(calls.some((call) => call.type === 'fetch' && call.url === 'https://cloak.example.com/api/v1/settings'));
  assert.ok(calls.some((call) => call.type === 'stdout' && call.message.includes('Production monitor check passed')));
  assert.ok(!calls.some((call) => call.url === 'https://alerts.example/webhook'));
});

test('runProductionMonitor sends an alert webhook when a check fails', async () => {
  const calls = [];
  const result = await runProductionMonitor({
    argv: [
      '--base-url',
      'https://cloak.example.com',
      '--admin-token',
      'secret-token',
      '--alert-webhook-url',
      'https://alerts.example/webhook'
    ],
    stdout: { write(message) { calls.push({ type: 'stdout', message }); } },
    stderr: { write(message) { calls.push({ type: 'stderr', message }); } },
    fetch: createMonitorFetch(calls, {
      healthBody: { success: true, data: { status: 'degraded' } }
    })
  });

  assert.equal(result.exitCode, 1);
  assert.ok(calls.some((call) => call.type === 'stderr' && call.message.includes('health payload status expected ok')));

  const alert = calls.find((call) => call.url === 'https://alerts.example/webhook');
  assert.equal(alert.options.method, 'POST');
  assert.equal(alert.options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(alert.options.body), {
    service: 'cloak',
    status: 'failed',
    baseUrl: 'https://cloak.example.com',
    error: 'health payload status expected ok, got degraded'
  });
});

test('runProductionMonitor checks analytics thresholds when enabled', async () => {
  const calls = [];
  const result = await runProductionMonitor({
    argv: [
      '--base-url',
      'https://cloak.example.com/',
      '--admin-token',
      'secret-token',
      '--check-analytics',
      '--max-bot-percent',
      '80',
      '--max-suspicious-percent',
      '20'
    ],
    stdout: { write(message) { calls.push({ type: 'stdout', message }); } },
    stderr: { write(message) { calls.push({ type: 'stderr', message }); } },
    fetch: createMonitorFetch(calls, {
      analyticsBody: {
        success: true,
        data: {
          totalVisits: 100,
          verdicts: {
            human: 80,
            bot: 15,
            suspicious: 5
          }
        }
      }
    })
  });

  assert.equal(result.exitCode, 0);
  assert.ok(calls.some((call) => call.type === 'fetch' && call.url === 'https://cloak.example.com/api/v1/analytics/overview'));
  assert.ok(calls.some((call) => call.type === 'stdout' && call.message.includes('bot 15.00%')));
});

test('runProductionMonitor fails and alerts when analytics thresholds are exceeded', async () => {
  const calls = [];
  const result = await runProductionMonitor({
    argv: [
      '--base-url',
      'https://cloak.example.com',
      '--admin-token',
      'secret-token',
      '--check-analytics',
      '--max-bot-percent',
      '50',
      '--alert-webhook-url',
      'https://alerts.example/webhook'
    ],
    stdout: { write(message) { calls.push({ type: 'stdout', message }); } },
    stderr: { write(message) { calls.push({ type: 'stderr', message }); } },
    fetch: createMonitorFetch(calls, {
      analyticsBody: {
        success: true,
        data: {
          totalVisits: 10,
          verdicts: {
            human: 3,
            bot: 7,
            suspicious: 0
          }
        }
      }
    })
  });

  assert.equal(result.exitCode, 1);
  assert.match(result.error.message, /analytics bot percent expected <= 50, got 70/);

  const alert = calls.find((call) => call.url === 'https://alerts.example/webhook');
  assert.equal(alert.options.method, 'POST');
  assert.deepEqual(JSON.parse(alert.options.body), {
    service: 'cloak',
    status: 'failed',
    baseUrl: 'https://cloak.example.com',
    error: 'analytics bot percent expected <= 50, got 70'
  });
});

function createMonitorFetch(calls, {
  healthStatus = 200,
  healthBody = { success: true, data: { status: 'ok' } },
  settingsStatus = 200,
  settingsBody = {
    success: true,
    data: {
      repository: {
        driver: 'postgres',
        databaseConfigured: true
      }
    }
  },
  analyticsStatus = 200,
  analyticsBody = {
    success: true,
    data: {
      totalVisits: 0,
      verdicts: {
        human: 0,
        bot: 0,
        suspicious: 0
      }
    }
  }
} = {}) {
  return async (url, options = {}) => {
    calls.push({ type: 'fetch', url, options });

    if (url.endsWith('/health')) {
      return jsonResponse(healthStatus, healthBody);
    }

    if (url.endsWith('/api/v1/settings')) {
      return jsonResponse(settingsStatus, settingsBody);
    }

    if (url.endsWith('/api/v1/analytics/overview')) {
      return jsonResponse(analyticsStatus, analyticsBody);
    }

    if (url === 'https://alerts.example/webhook') {
      return jsonResponse(202, { ok: true });
    }

    throw new Error(`Unexpected URL: ${url}`);
  };
}

function jsonResponse(status, body) {
  return {
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}
