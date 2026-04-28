import { startServer as startHttpServer } from '../server/start.js';
import {
  formatMigrationStatusSummary,
  isDirectRun,
  runMigrationStatusCommand as collectMigrationStatus
} from './run-migrations.js';

const SAFE_URL = 'https://white.example/preflight';
const MONEY_URL = 'https://black.example/preflight';

export function parseProductionPreflightArgs(argv = process.argv.slice(2)) {
  const parsed = {
    databaseUrl: undefined,
    adminToken: undefined,
    migrationsDir: undefined,
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

    if (argument === '--migrations-dir') {
      parsed.migrationsDir = requireCliValue(argv, index, '--migrations-dir');
      index += 1;
      continue;
    }

    if (argument.startsWith('--migrations-dir=')) {
      parsed.migrationsDir = argument.slice('--migrations-dir='.length);
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return parsed;
}

export function formatProductionPreflightSummary({
  pendingMigrationCount,
  healthStatus,
  settingsRepository,
  adminPageStatus,
  botRedirectStatus,
  botRedirectLocation,
  humanRedirectStatus,
  humanRedirectLocation,
  campaignLogCount,
  cleanup
} = {}) {
  return [
    'PostgreSQL production preflight passed',
    `Pending migrations: ${pendingMigrationCount}`,
    `Health status: ${healthStatus}`,
    `Settings repository: ${settingsRepository}`,
    `Admin page status: ${adminPageStatus}`,
    `Bot redirect: ${botRedirectStatus} -> ${botRedirectLocation}`,
    `Human redirect: ${humanRedirectStatus} -> ${humanRedirectLocation}`,
    `Campaign log count: ${campaignLogCount}`,
    `Cleanup: ${cleanup}`
  ].join('\n');
}

export function formatProductionPreflightHelp() {
  return [
    'PostgreSQL Production Preflight CLI',
    '',
    'Runs a release-gate check against a PostgreSQL-backed Cloak runtime.',
    '',
    'Checks:',
    '  migration status has no pending files',
    '  health/settings/admin endpoints work in postgres mode',
    '  Googlebot traffic goes to the white page',
    '  human browser traffic goes to the black page',
    '  temporary campaign and logs are cleaned up',
    '',
    'Flags:',
    '  --database-url <url>   Override DATABASE_URL for this command',
    '  --admin-token <token>  Override ADMIN_TOKEN for this command',
    '  --migrations-dir <dir> Override the migrations directory',
    '  --help                 Show this help text'
  ].join('\n');
}

export async function runProductionPreflight({
  argv = process.argv.slice(2),
  stdout = process.stdout,
  stderr = process.stderr,
  runMigrationStatusCommand = collectMigrationStatus,
  startServer = startHttpServer,
  fetch: fetchImpl = fetch
} = {}) {
  let server;
  let cleanupContext;

  try {
    const cliArgs = parseProductionPreflightArgs(argv);

    if (cliArgs.help) {
      stdout.write(`${formatProductionPreflightHelp()}\n`);
      return { exitCode: 0 };
    }

    const adminToken = cliArgs.adminToken ?? process.env.ADMIN_TOKEN ?? 'dev-admin-token';
    const migrationStatus = await runMigrationStatusCommand({
      databaseUrl: cliArgs.databaseUrl,
      migrationsDir: cliArgs.migrationsDir,
      config: {
        repository: {
          driver: 'postgres'
        }
      }
    });

    if ((migrationStatus.pendingMigrations ?? []).length > 0) {
      throw new Error([
        'Pending migrations must be applied before preflight.',
        formatMigrationStatusSummary(migrationStatus)
      ].join('\n'));
    }

    server = await startServer({
      config: {
        server: {
          host: '127.0.0.1',
          port: 0
        },
        detection: {
          botIps: []
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
    const authHeaders = {
      Authorization: `Bearer ${adminToken}`
    };

    const health = await requestJsonResponse(fetchImpl, `${baseUrl}/health`);
    if (health.body.data?.status !== 'ok') {
      throw new Error(`health status payload was ${health.body.data?.status ?? 'unknown'}`);
    }

    const settings = await requestJson(fetchImpl, `${baseUrl}/api/v1/settings`, {
      headers: authHeaders
    });
    assertEqual(settings.data?.repository?.driver, 'postgres', 'settings repository');
    assertEqual(settings.data?.repository?.databaseConfigured, true, 'settings databaseConfigured');

    const adminPage = await requestText(fetchImpl, `${baseUrl}/admin`);
    await requestText(fetchImpl, `${baseUrl}/admin/styles.css`);
    await requestText(fetchImpl, `${baseUrl}/admin/app.js`);

    const created = await requestJson(fetchImpl, `${baseUrl}/api/v1/campaigns`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `Production Preflight ${Date.now()}`,
        safeUrl: SAFE_URL,
        moneyUrl: MONEY_URL,
        redirectMode: 'redirect'
      })
    });
    const campaignId = created.data.id;
    cleanupContext = {
      baseUrl,
      campaignId,
      fetchImpl,
      headers: authHeaders
    };

    const botRedirect = await fetchImpl(`${baseUrl}/c/${campaignId}`, {
      redirect: 'manual',
      headers: {
        'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)'
      }
    });
    assertRedirect(botRedirect, SAFE_URL, 'bot redirect');

    const humanRedirect = await fetchImpl(`${baseUrl}/c/${campaignId}`, {
      redirect: 'manual',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36'
      }
    });
    assertRedirect(humanRedirect, MONEY_URL, 'human redirect');

    const logs = await requestJson(fetchImpl, `${baseUrl}/api/v1/campaigns/${campaignId}/logs?pageSize=10`, {
      headers: authHeaders
    });
    const campaignLogCount = logs.pagination?.total ?? logs.data.length;
    if (campaignLogCount < 2) {
      throw new Error(`campaign logs expected at least 2 records, got ${campaignLogCount}`);
    }

    const cleanup = await cleanupPreflightArtifacts(cleanupContext);
    cleanupContext = undefined;

    stdout.write(`${formatProductionPreflightSummary({
      pendingMigrationCount: migrationStatus.pendingMigrations.length,
      healthStatus: health.status,
      settingsRepository: settings.data.repository.driver,
      adminPageStatus: adminPage.status,
      botRedirectStatus: botRedirect.status,
      botRedirectLocation: getLocation(botRedirect),
      humanRedirectStatus: humanRedirect.status,
      humanRedirectLocation: getLocation(humanRedirect),
      campaignLogCount,
      cleanup
    })}\n`);

    return { exitCode: 0 };
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return { exitCode: 1, error };
  } finally {
    if (cleanupContext) {
      try {
        await cleanupPreflightArtifacts(cleanupContext);
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

if (isDirectRun(import.meta.url, process.argv[1])) {
  runProductionPreflight().then(({ exitCode }) => {
    process.exitCode = exitCode;
  });
}

async function cleanupPreflightArtifacts({ baseUrl, campaignId, fetchImpl, headers }) {
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

function assertRedirect(response, expectedLocation, label) {
  const location = getLocation(response);

  if (![301, 302, 303, 307, 308].includes(response.status) || location !== expectedLocation) {
    throw new Error(`${label} expected ${expectedLocation}, got ${response.status} -> ${location ?? '(none)'}`);
  }
}

function getLocation(response) {
  return response.headers?.get?.('location') ?? response.headers?.get?.('Location') ?? null;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${expected}, got ${actual}`);
  }
}

function requireCliValue(argv, index, flagName) {
  const value = argv[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`Flag ${flagName} requires a value.`);
  }

  return value;
}
