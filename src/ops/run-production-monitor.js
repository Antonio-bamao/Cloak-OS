import { isDirectRun } from '../database/run-migrations.js';

const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';

export function parseProductionMonitorArgs(argv = process.argv.slice(2)) {
  const parsed = {
    baseUrl: undefined,
    adminToken: undefined,
    expectRepository: undefined,
    checkAnalytics: false,
    maxBotPercent: undefined,
    maxSuspiciousPercent: undefined,
    alertWebhookUrl: undefined,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--help') {
      parsed.help = true;
      continue;
    }

    if (argument === '--base-url') {
      parsed.baseUrl = requireCliValue(argv, index, '--base-url');
      index += 1;
      continue;
    }

    if (argument.startsWith('--base-url=')) {
      parsed.baseUrl = argument.slice('--base-url='.length);
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

    if (argument === '--expect-repository') {
      parsed.expectRepository = requireCliValue(argv, index, '--expect-repository');
      index += 1;
      continue;
    }

    if (argument.startsWith('--expect-repository=')) {
      parsed.expectRepository = argument.slice('--expect-repository='.length);
      continue;
    }

    if (argument === '--check-analytics') {
      parsed.checkAnalytics = true;
      continue;
    }

    if (argument === '--max-bot-percent') {
      parsed.maxBotPercent = parsePercent(requireCliValue(argv, index, '--max-bot-percent'), '--max-bot-percent');
      index += 1;
      continue;
    }

    if (argument.startsWith('--max-bot-percent=')) {
      parsed.maxBotPercent = parsePercent(argument.slice('--max-bot-percent='.length), '--max-bot-percent');
      continue;
    }

    if (argument === '--max-suspicious-percent') {
      parsed.maxSuspiciousPercent = parsePercent(
        requireCliValue(argv, index, '--max-suspicious-percent'),
        '--max-suspicious-percent'
      );
      index += 1;
      continue;
    }

    if (argument.startsWith('--max-suspicious-percent=')) {
      parsed.maxSuspiciousPercent = parsePercent(
        argument.slice('--max-suspicious-percent='.length),
        '--max-suspicious-percent'
      );
      continue;
    }

    if (argument === '--alert-webhook-url') {
      parsed.alertWebhookUrl = requireCliValue(argv, index, '--alert-webhook-url');
      index += 1;
      continue;
    }

    if (argument.startsWith('--alert-webhook-url=')) {
      parsed.alertWebhookUrl = argument.slice('--alert-webhook-url='.length);
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return parsed;
}

export function formatProductionMonitorHelp() {
  return [
    'Production Monitor CLI',
    '',
    'Checks a running Cloak app and optionally sends a webhook alert on failure.',
    '',
    'Checks:',
    '  health endpoint returns 200 with status ok',
    '  settings endpoint returns 200 with expected repository state',
    '  optional analytics overview thresholds for bot and suspicious traffic',
    '',
    'Flags:',
    '  --base-url <url>           Base app URL, defaults to MONITOR_BASE_URL or http://127.0.0.1:3000',
    '  --admin-token <token>      Admin token, defaults to ADMIN_TOKEN',
    '  --expect-repository <name> Expected repository driver, defaults to MONITOR_EXPECT_REPOSITORY or postgres',
    '  --check-analytics          Also check /api/v1/analytics/overview',
    '  --max-bot-percent <n>      Fail when bot verdict percentage is above n',
    '  --max-suspicious-percent <n> Fail when suspicious verdict percentage is above n',
    '  --alert-webhook-url <url>  Optional webhook URL to POST a failure alert',
    '  --help                     Show this help text'
  ].join('\n');
}

export function formatProductionMonitorSummary({
  baseUrl,
  healthStatus,
  healthPayloadStatus,
  settingsStatus,
  repositoryDriver,
  databaseConfigured,
  analyticsStatus,
  totalVisits,
  botPercent,
  suspiciousPercent
} = {}) {
  const lines = [
    'Production monitor check passed',
    `Base URL: ${baseUrl}`,
    `Health: ${healthStatus} / ${healthPayloadStatus}`,
    `Settings: ${settingsStatus} / ${repositoryDriver} / ${databaseConfigured ? 'database configured' : 'database not configured'}`
  ];

  if (analyticsStatus !== undefined) {
    lines.push(`Analytics: ${analyticsStatus} / visits ${totalVisits} / bot ${formatPercent(botPercent)} / suspicious ${formatPercent(suspiciousPercent)}`);
  }

  return lines.join('\n');
}

export async function runProductionMonitor({
  argv = process.argv.slice(2),
  stdout = process.stdout,
  stderr = process.stderr,
  fetch: fetchImpl = fetch,
  env = process.env
} = {}) {
  let options;

  try {
    const cliArgs = parseProductionMonitorArgs(argv);

    if (cliArgs.help) {
      stdout.write(`${formatProductionMonitorHelp()}\n`);
      return { exitCode: 0 };
    }

    options = resolveMonitorOptions(cliArgs, env);
    const result = await checkProductionRuntime({ ...options, fetchImpl });

    stdout.write(`${formatProductionMonitorSummary(result)}\n`);
    return { exitCode: 0 };
  } catch (error) {
    stderr.write(`${error.message}\n`);

    if (options?.alertWebhookUrl) {
      try {
        await sendFailureAlert({
          fetchImpl,
          alertWebhookUrl: options.alertWebhookUrl,
          baseUrl: options.baseUrl,
          error
        });
      } catch (alertError) {
        stderr.write(`Alert webhook failed: ${alertError.message}\n`);
      }
    }

    return { exitCode: 1, error };
  }
}

async function checkProductionRuntime({
  baseUrl,
  adminToken,
  expectRepository,
  checkAnalytics,
  maxBotPercent,
  maxSuspiciousPercent,
  fetchImpl
}) {
  const health = await requestJson(fetchImpl, joinUrl(baseUrl, '/health'));
  assertEqual(health.status, 200, 'health HTTP status');
  assertEqual(health.body.data?.status, 'ok', 'health payload status');

  const settings = await requestJson(fetchImpl, joinUrl(baseUrl, '/api/v1/settings'), {
    headers: {
      Authorization: `Bearer ${adminToken}`
    }
  });
  assertEqual(settings.status, 200, 'settings HTTP status');

  const repository = settings.body.data?.repository ?? {};
  if (expectRepository) {
    assertEqual(repository.driver, expectRepository, 'settings repository driver');
  }

  if (expectRepository === 'postgres') {
    assertEqual(repository.databaseConfigured, true, 'settings databaseConfigured');
  }

  const result = {
    baseUrl,
    healthStatus: health.status,
    healthPayloadStatus: health.body.data?.status,
    settingsStatus: settings.status,
    repositoryDriver: repository.driver,
    databaseConfigured: Boolean(repository.databaseConfigured)
  };

  if (checkAnalytics) {
    const analytics = await requestJson(fetchImpl, joinUrl(baseUrl, '/api/v1/analytics/overview'), {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });
    assertEqual(analytics.status, 200, 'analytics HTTP status');

    const analyticsData = analytics.body.data ?? {};
    const totalVisits = Number(analyticsData.totalVisits ?? 0);
    const verdicts = analyticsData.verdicts ?? {};
    const botPercent = calculatePercent(Number(verdicts.bot ?? 0), totalVisits);
    const suspiciousPercent = calculatePercent(Number(verdicts.suspicious ?? 0), totalVisits);

    if (maxBotPercent !== undefined && botPercent > maxBotPercent) {
      throw new Error(`analytics bot percent expected <= ${maxBotPercent}, got ${botPercent}`);
    }

    if (maxSuspiciousPercent !== undefined && suspiciousPercent > maxSuspiciousPercent) {
      throw new Error(`analytics suspicious percent expected <= ${maxSuspiciousPercent}, got ${suspiciousPercent}`);
    }

    Object.assign(result, {
      analyticsStatus: analytics.status,
      totalVisits,
      botPercent,
      suspiciousPercent
    });
  }

  return result;
}

async function sendFailureAlert({
  fetchImpl,
  alertWebhookUrl,
  baseUrl,
  error
}) {
  const response = await fetchImpl(alertWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      service: 'cloak',
      status: 'failed',
      baseUrl,
      error: error.message
    })
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}`);
  }
}

function resolveMonitorOptions(cliArgs, env) {
  return {
    baseUrl: trimTrailingSlash(cliArgs.baseUrl ?? env.MONITOR_BASE_URL ?? DEFAULT_BASE_URL),
    adminToken: cliArgs.adminToken ?? env.ADMIN_TOKEN ?? '',
    expectRepository: cliArgs.expectRepository ?? env.MONITOR_EXPECT_REPOSITORY ?? 'postgres',
    checkAnalytics: cliArgs.checkAnalytics || env.MONITOR_CHECK_ANALYTICS === 'true',
    maxBotPercent: cliArgs.maxBotPercent ?? parseOptionalPercent(env.MONITOR_MAX_BOT_PERCENT, 'MONITOR_MAX_BOT_PERCENT'),
    maxSuspiciousPercent: cliArgs.maxSuspiciousPercent
      ?? parseOptionalPercent(env.MONITOR_MAX_SUSPICIOUS_PERCENT, 'MONITOR_MAX_SUSPICIOUS_PERCENT'),
    alertWebhookUrl: cliArgs.alertWebhookUrl ?? env.ALERT_WEBHOOK_URL ?? ''
  };
}

async function requestJson(fetchImpl, url, options) {
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

function joinUrl(baseUrl, path) {
  return `${trimTrailingSlash(baseUrl)}${path}`;
}

function trimTrailingSlash(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${expected}, got ${actual}`);
  }
}

function calculatePercent(count, total) {
  if (!total) {
    return 0;
  }

  return (count / total) * 100;
}

function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

function parseOptionalPercent(value, label) {
  if (value === undefined || value === '') {
    return undefined;
  }

  return parsePercent(value, label);
}

function parsePercent(value, label) {
  const percent = Number(value);

  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error(`${label} must be a number from 0 to 100.`);
  }

  return percent;
}

function requireCliValue(argv, index, flagName) {
  const value = argv[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`Flag ${flagName} requires a value.`);
  }

  return value;
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  runProductionMonitor().then(({ exitCode }) => {
    process.exitCode = exitCode;
  });
}
