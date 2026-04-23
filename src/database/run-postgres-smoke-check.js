import {
  formatMigrationDryRunSummary,
  formatMigrationStatusSummary,
  isDirectRun,
  runMigrationStatusCommand
} from './run-migrations.js';

export function parsePostgresSmokeCheckArgs(argv = process.argv.slice(2)) {
  const parsed = {
    databaseUrl: undefined,
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

export function formatPostgresSmokeCheckSummary({
  statusSummary,
  dryRunSummary
} = {}) {
  return [
    'PostgreSQL smoke check passed',
    '',
    'Migration status:',
    statusSummary,
    '',
    'Migration dry run:',
    dryRunSummary
  ].join('\n');
}

export function formatPostgresSmokeCheckHelp() {
  return [
    'PostgreSQL Smoke Check CLI',
    '',
    'Readonly checks for a PostgreSQL target before real app startup.',
    '',
    'Flags:',
    '  --database-url <url>   Override DATABASE_URL for this command',
    '  --migrations-dir <dir> Override the migrations directory',
    '  --help                 Show this help text'
  ].join('\n');
}

export async function runPostgresSmokeCheck({
  argv = process.argv.slice(2),
  stdout = process.stdout,
  stderr = process.stderr,
  runMigrationStatusCommand: executeMigrationStatusCommand = runMigrationStatusCommand
} = {}) {
  try {
    const cliArgs = parsePostgresSmokeCheckArgs(argv);

    if (cliArgs.help) {
      stdout.write(`${formatPostgresSmokeCheckHelp()}\n`);
      return { exitCode: 0 };
    }

    const status = await executeMigrationStatusCommand({
      databaseUrl: cliArgs.databaseUrl,
      migrationsDir: cliArgs.migrationsDir,
      config: {
        repository: {
          driver: 'postgres'
        }
      }
    });

    stdout.write(
      `${formatPostgresSmokeCheckSummary({
        statusSummary: formatMigrationStatusSummary(status),
        dryRunSummary: formatMigrationDryRunSummary(status)
      })}\n`
    );

    return { exitCode: 0 };
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return { exitCode: 1, error };
  }
}

if (isDirectRun(import.meta.url)) {
  runPostgresSmokeCheck().then(({ exitCode }) => {
    process.exitCode = exitCode;
  });
}

function requireCliValue(argv, index, flagName) {
  const value = argv[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`Flag ${flagName} requires a value.`);
  }

  return value;
}
