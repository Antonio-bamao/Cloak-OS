import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { startServer as startHttpServer } from '../server/start.js';

export function parsePostgresAdminSmokeCheckArgs(argv = process.argv.slice(2)) {
  const parsed = {
    databaseUrl: undefined,
    adminToken: undefined,
    checkHealth: false,
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

    throw new Error(`Unknown argument: ${argument}`);
  }

  return parsed;
}

export function formatPostgresAdminSmokeCheckSummary({
  pageStatus,
  campaignCount,
  logCount,
  totalVisits,
  healthStatus
} = {}) {
  return [
    'PostgreSQL admin smoke check passed',
    `Admin page status: ${pageStatus}`,
    `Campaign count: ${campaignCount}`,
    `Log count: ${logCount}`,
    `Total visits: ${totalVisits}`,
    ...(healthStatus ? [`Health status: ${healthStatus}`] : [])
  ].join('\n');
}

export function formatPostgresAdminSmokeCheckHelp() {
  return [
    'PostgreSQL Admin Smoke Check CLI',
    '',
    'Starts the app in postgres mode, loads the admin shell/assets, and checks admin APIs.',
    '',
    'Flags:',
    '  --database-url <url> Override DATABASE_URL for this command',
    '  --admin-token <token> Override ADMIN_TOKEN for this command',
    '  --check-health       Probe GET /health before loading admin assets',
    '  --help               Show this help text'
  ].join('\n');
}

export async function runPostgresAdminSmokeCheck({
  argv = process.argv.slice(2),
  stdout = process.stdout,
  stderr = process.stderr,
  startServer = startHttpServer,
  fetch: fetchImpl = fetch
} = {}) {
  let server;

  try {
    const cliArgs = parsePostgresAdminSmokeCheckArgs(argv);

    if (cliArgs.help) {
      stdout.write(`${formatPostgresAdminSmokeCheckHelp()}\n`);
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
      Authorization: `Bearer ${adminToken}`
    };

    const adminPage = await requestText(fetchImpl, `${baseUrl}/admin`);
    assertIncludes(adminPage.text, 'id="app-shell"', 'admin page shell');
    assertIncludes(adminPage.text, 'id="error-banner"', 'admin UI state shell');
    assertIncludes(adminPage.text, 'id="retry-error"', 'admin UI state shell');
    assertIncludes(adminPage.text, '/admin/styles.css', 'admin stylesheet link');
    assertIncludes(adminPage.text, '/admin/app.js', 'admin app script');

    const stylesheet = await requestText(fetchImpl, `${baseUrl}/admin/styles.css`);
    assertIncludes(stylesheet.text, '--accent-green', 'admin stylesheet');
    assertIncludes(stylesheet.text, '--surface-panel', 'admin stylesheet');
    assertIncludes(stylesheet.text, '.error-banner', 'admin UI state stylesheet');
    assertIncludes(stylesheet.text, '.empty-state', 'admin UI state stylesheet');

    const script = await requestText(fetchImpl, `${baseUrl}/admin/app.js`);
    assertIncludes(script.text, 'loadOverview', 'admin app script');
    assertIncludes(script.text, 'loadCampaigns', 'admin app script');
    assertIncludes(script.text, 'loadLogs', 'admin app script');
    assertIncludes(script.text, 'handleUiError', 'admin UI state script');
    assertIncludes(script.text, 'emptyState', 'admin UI state script');

    const campaigns = await requestJson(fetchImpl, `${baseUrl}/api/v1/campaigns`, { headers });
    const logs = await requestJson(fetchImpl, `${baseUrl}/api/v1/logs?pageSize=5`, { headers });
    const analytics = await requestJson(fetchImpl, `${baseUrl}/api/v1/analytics/overview`, { headers });
    const summary = formatPostgresAdminSmokeCheckSummary({
      pageStatus: adminPage.status,
      campaignCount: campaigns.data.length,
      logCount: logs.pagination?.total ?? logs.data.length,
      totalVisits: analytics.data.totalVisits,
      healthStatus: health?.status
    });

    stdout.write(`${summary}\n`);
    return { exitCode: 0 };
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return { exitCode: 1, error };
  } finally {
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
  runPostgresAdminSmokeCheck().then(({ exitCode }) => {
    process.exitCode = exitCode;
  });
}

async function requestText(fetchImpl, url, options) {
  const response = await fetchImpl(url, options);
  const text = await response.text();

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}: ${text || 'request failed'}`);
  }

  return {
    status: response.status,
    text
  };
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

function assertIncludes(value, expected, label) {
  if (!value.includes(expected)) {
    throw new Error(`${label} did not include ${expected}`);
  }
}

function requireCliValue(argv, index, flagName) {
  const value = argv[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`Flag ${flagName} requires a value.`);
  }

  return value;
}
