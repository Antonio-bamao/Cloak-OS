import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { startServer as startHttpServer } from '../server/start.js';

export function parsePostgresApiSmokeCheckArgs(argv = process.argv.slice(2)) {
  const parsed = {
    databaseUrl: undefined,
    adminToken: undefined,
    checkHealth: false,
    keepCampaign: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--help') {
      parsed.help = true;
      continue;
    }

    if (argument === '--database-url') {
      parsed.databaseUrl = requireCliValue(argv, index, '--database-url');
      index += 1;
      continue;
    }

    if (argument.startsWith('--database-url=')) {
      parsed.databaseUrl = argument.slice('--database-url='.length);
      continue;
    }

    if (argument === '--admin-token') {
      parsed.adminToken = requireCliValue(argv, index, '--admin-token');
      index += 1;
      continue;
    }

    if (argument.startsWith('--admin-token=')) {
      parsed.adminToken = argument.slice('--admin-token='.length);
      continue;
    }

    if (argument === '--check-health') {
      parsed.checkHealth = true;
      continue;
    }

    if (argument === '--keep-campaign') {
      parsed.keepCampaign = true;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return parsed;
}

export function formatPostgresApiSmokeCheckSummary({
  campaignId,
  redirectStatus,
  logCount,
  totalVisits,
  healthStatus,
  cleanup
} = {}) {
  return [
    'PostgreSQL API smoke check passed',
    `Campaign ID: ${campaignId}`,
    `Redirect status: ${redirectStatus}`,
    `Log count: ${logCount}`,
    `Total visits: ${totalVisits}`,
    ...(healthStatus ? [`Health status: ${healthStatus}`] : []),
    `Cleanup: ${cleanup}`
  ].join('\n');
}

export function formatPostgresApiSmokeCheckHelp() {
  return [
    'PostgreSQL API Smoke Check CLI',
    '',
    'Starts the app in postgres mode, creates a campaign, visits it, checks logs/analytics, then cleans up smoke data.',
    '',
    'Flags:',
    '  --database-url <url> Override DATABASE_URL for this command',
    '  --admin-token <token> Override ADMIN_TOKEN for this command',
    '  --check-health       Probe GET /health before running API smoke steps',
    '  --keep-campaign      Leave the created smoke campaign and logs in the database',
    '  --help               Show this help text'
  ].join('\n');
}

export async function runPostgresApiSmokeCheck({
  argv = process.argv.slice(2),
  stdout = process.stdout,
  stderr = process.stderr,
  startServer = startHttpServer,
  fetch: fetchImpl = fetch
} = {}) {
  let server;
  let cleanupContext;

  try {
    const cliArgs = parsePostgresApiSmokeCheckArgs(argv);

    if (cliArgs.help) {
      stdout.write(`${formatPostgresApiSmokeCheckHelp()}\n`);
      return { exitCode: 0 };
    }

    const adminToken = cliArgs.adminToken ?? process.env.ADMIN_TOKEN ?? 'dev-admin-token';
    server = await startServer({
      config: {
        server: {
          host: '127.0.0.1',
          port: 0
        },
        auth: {
          adminToken
        },
        repository: {
          driver: 'postgres',
          databaseUrl: cliArgs.databaseUrl
        }
      }
    });
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    const health = cliArgs.checkHealth
      ? await probeHealth({ baseUrl, fetchImpl })
      : null;
    const headers = {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    };

    const created = await requestJson(fetchImpl, `${baseUrl}/api/v1/campaigns`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `Postgres Smoke ${Date.now()}`,
        safeUrl: 'https://safe.example/smoke',
        moneyUrl: 'https://money.example/smoke',
        redirectMode: 'redirect'
      })
    });
    const campaignId = created.data.id;
    cleanupContext = {
      baseUrl,
      campaignId,
      fetchImpl,
      headers,
      keepCampaign: cliArgs.keepCampaign
    };
    const redirectResponse = await fetchImpl(`${baseUrl}/c/${campaignId}`, {
      redirect: 'manual',
      headers: {
        'user-agent': 'Mozilla/5.0 CloakSmokeCheck'
      }
    });
    assertStatus(redirectResponse.status, [301, 302, 303, 307, 308], 'cloak redirect');

    const logs = await requestJson(fetchImpl, `${baseUrl}/api/v1/logs?pageSize=5`, {
      headers
    });
    const analytics = await requestJson(fetchImpl, `${baseUrl}/api/v1/analytics/overview`, {
      headers
    });
    const cleanup = await cleanupSmokeArtifacts(cleanupContext);
    cleanupContext = undefined;
    const summary = formatPostgresApiSmokeCheckSummary({
      campaignId,
      redirectStatus: redirectResponse.status,
      logCount: logs.pagination?.total ?? logs.data.length,
      totalVisits: analytics.data.totalVisits,
      healthStatus: health?.status,
      cleanup
    });

    stdout.write(`${summary}\n`);
    return { exitCode: 0 };
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return { exitCode: 1, error };
  } finally {
    if (cleanupContext) {
      try {
        await cleanupSmokeArtifacts(cleanupContext);
      } catch (error) {
        stderr.write(`Cleanup failed: ${error.message}\n`);
      }
    }

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  }
}

export function isDirectRun(moduleUrl, entryPath = process.argv[1]) {
  if (!entryPath) {
    return false;
  }

  return path.resolve(fileURLToPath(moduleUrl)) === path.resolve(entryPath);
}

if (isDirectRun(import.meta.url)) {
  runPostgresApiSmokeCheck().then(({ exitCode }) => {
    process.exitCode = exitCode;
  });
}

async function requestJson(fetchImpl, url, options) {
  const { body } = await requestJsonResponse(fetchImpl, url, options);
  return body;
}

async function requestJsonResponse(fetchImpl, url, options) {
  const response = await fetchImpl(url, options);
  const body = await response.json();

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}: ${body.error?.message ?? 'request failed'}`);
  }

  return {
    status: response.status,
    body
  };
}

async function probeHealth({ baseUrl, fetchImpl }) {
  const health = await requestJsonResponse(fetchImpl, `${baseUrl}/health`);

  if (health.body.data?.status !== 'ok') {
    throw new Error(`Health probe returned unexpected status payload: ${health.body.data?.status ?? 'unknown'}`);
  }

  return health;
}

async function cleanupSmokeArtifacts({ baseUrl, campaignId, fetchImpl, headers, keepCampaign }) {
  if (keepCampaign) {
    return 'kept';
  }

  await requestJson(fetchImpl, `${baseUrl}/api/v1/campaigns/${campaignId}/logs`, {
    method: 'DELETE',
    headers
  });

  await requestJson(fetchImpl, `${baseUrl}/api/v1/campaigns/${campaignId}`, {
    method: 'DELETE',
    headers
  });

  return 'logs deleted, campaign deleted';
}

function assertStatus(actual, expected, label) {
  if (!expected.includes(actual)) {
    throw new Error(`${label} returned unexpected status ${actual}`);
  }
}

function requireCliValue(argv, index, flagName) {
  const value = argv[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`Flag ${flagName} requires a value.`);
  }

  return value;
}
