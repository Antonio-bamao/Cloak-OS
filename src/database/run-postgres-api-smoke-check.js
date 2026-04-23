import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { startServer as startHttpServer } from '../server/start.js';

export function parsePostgresApiSmokeCheckArgs(argv = process.argv.slice(2)) {
  const parsed = {
    databaseUrl: undefined,
    adminToken: undefined,
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

    throw new Error(`Unknown argument: ${argument}`);
  }

  return parsed;
}

export function formatPostgresApiSmokeCheckSummary({
  campaignId,
  redirectStatus,
  logCount,
  totalVisits
} = {}) {
  return [
    'PostgreSQL API smoke check passed',
    `Campaign ID: ${campaignId}`,
    `Redirect status: ${redirectStatus}`,
    `Log count: ${logCount}`,
    `Total visits: ${totalVisits}`
  ].join('\n');
}

export function formatPostgresApiSmokeCheckHelp() {
  return [
    'PostgreSQL API Smoke Check CLI',
    '',
    'Starts the app in postgres mode, creates a campaign, visits it, and checks logs/analytics.',
    '',
    'Flags:',
    '  --database-url <url> Override DATABASE_URL for this command',
    '  --admin-token <token> Override ADMIN_TOKEN for this command',
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
    const summary = formatPostgresApiSmokeCheckSummary({
      campaignId,
      redirectStatus: redirectResponse.status,
      logCount: logs.pagination?.total ?? logs.data.length,
      totalVisits: analytics.data.totalVisits
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
  runPostgresApiSmokeCheck().then(({ exitCode }) => {
    process.exitCode = exitCode;
  });
}

async function requestJson(fetchImpl, url, options) {
  const response = await fetchImpl(url, options);
  const body = await response.json();

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}: ${body.error?.message ?? 'request failed'}`);
  }

  return body;
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
