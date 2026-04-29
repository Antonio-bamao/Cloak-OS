import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { parseBotIpFile } from '../detectors/bot-ip-source.js';
import { isDirectRun } from '../database/run-migrations.js';

export function parseBotIpSyncArgs(argv = process.argv.slice(2)) {
  const parsed = {
    sourceUrls: [],
    sourceFiles: [],
    output: undefined,
    dryRun: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--help') {
      parsed.help = true;
      continue;
    }

    if (argument === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }

    if (argument === '--source-url') {
      parsed.sourceUrls.push(requireCliValue(argv, index, '--source-url'));
      index += 1;
      continue;
    }

    if (argument.startsWith('--source-url=')) {
      parsed.sourceUrls.push(argument.slice('--source-url='.length));
      continue;
    }

    if (argument === '--source-file') {
      parsed.sourceFiles.push(requireCliValue(argv, index, '--source-file'));
      index += 1;
      continue;
    }

    if (argument.startsWith('--source-file=')) {
      parsed.sourceFiles.push(argument.slice('--source-file='.length));
      continue;
    }

    if (argument === '--output') {
      parsed.output = requireCliValue(argv, index, '--output');
      index += 1;
      continue;
    }

    if (argument.startsWith('--output=')) {
      parsed.output = argument.slice('--output='.length);
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return parsed;
}

export function formatBotIpSyncHelp() {
  return [
    'Bot IP Sync CLI',
    '',
    'Normalizes text Bot IP sources into the file used by BOT_IP_SOURCE=file.',
    '',
    'Source format:',
    '  one IP per line, blank lines allowed, # comments ignored',
    '',
    'Flags:',
    '  --source-url <url>   Text URL to fetch; can be repeated',
    '  --source-file <path> Local text file to read; can be repeated',
    '  --output <path>      Output file path, usually BOT_IP_FILE_PATH',
    '  --dry-run            Print the summary without writing the output file',
    '  --help               Show this help text'
  ].join('\n');
}

export function formatBotIpSyncSummary({
  sourceCount,
  output,
  botIps,
  dryRun
} = {}) {
  return [
    'Bot IP sync completed',
    `Sources: ${sourceCount}`,
    `Output: ${output}`,
    `Count: ${botIps.length}`,
    `Mode: ${dryRun ? 'dry-run' : 'write'}`
  ].join('\n');
}

export async function runBotIpSync({
  argv = process.argv.slice(2),
  stdout = process.stdout,
  stderr = process.stderr,
  env = process.env,
  fetch: fetchImpl = fetch,
  readFile: readFileImpl = readFile,
  writeFile: writeFileImpl = writeFile,
  mkdir: mkdirImpl = mkdir
} = {}) {
  try {
    const cliArgs = parseBotIpSyncArgs(argv);

    if (cliArgs.help) {
      stdout.write(`${formatBotIpSyncHelp()}\n`);
      return { exitCode: 0 };
    }

    const options = resolveBotIpSyncOptions(cliArgs, env);
    const botIps = await collectBotIps({ ...options, fetchImpl, readFileImpl });

    if (!options.dryRun) {
      const outputDirectory = dirname(options.output);
      if (outputDirectory && outputDirectory !== '.') {
        await mkdirImpl(outputDirectory, { recursive: true });
      }
      await writeFileImpl(options.output, formatBotIpFile(botIps), 'utf8');
    }

    stdout.write(`${formatBotIpSyncSummary({
      sourceCount: options.sourceUrls.length + options.sourceFiles.length,
      output: options.output,
      botIps,
      dryRun: options.dryRun
    })}\n`);

    return { exitCode: 0, botIps };
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return { exitCode: 1, error };
  }
}

export function normalizeBotIps(contents) {
  return [...new Set(contents.flatMap((content) => parseBotIpFile(content)))];
}

function resolveBotIpSyncOptions(cliArgs, env) {
  const sourceUrls = cliArgs.sourceUrls.length > 0
    ? cliArgs.sourceUrls
    : splitCsv(env.BOT_IP_SYNC_URLS);
  const sourceFiles = cliArgs.sourceFiles.length > 0
    ? cliArgs.sourceFiles
    : splitCsv(env.BOT_IP_SYNC_FILES);
  const output = cliArgs.output ?? env.BOT_IP_FILE_PATH ?? '';

  if (sourceUrls.length === 0 && sourceFiles.length === 0) {
    throw new Error('At least one --source-url or --source-file is required.');
  }

  if (!output) {
    throw new Error('Flag --output or BOT_IP_FILE_PATH is required.');
  }

  return {
    sourceUrls,
    sourceFiles,
    output,
    dryRun: cliArgs.dryRun
  };
}

async function collectBotIps({
  sourceUrls,
  sourceFiles,
  fetchImpl,
  readFileImpl
}) {
  const urlContents = await Promise.all(sourceUrls.map(async (url) => {
    const response = await fetchImpl(url);

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Bot IP source URL failed: ${url} returned HTTP ${response.status}`);
    }

    return response.text();
  }));
  const fileContents = await Promise.all(sourceFiles.map((path) => readFileImpl(path, 'utf8')));

  return normalizeBotIps([...urlContents, ...fileContents]);
}

function formatBotIpFile(botIps) {
  return [
    '# Generated by npm run bot-ips:sync',
    ...botIps,
    ''
  ].join('\n');
}

function splitCsv(value = '') {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function requireCliValue(argv, index, flagName) {
  const value = argv[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`Flag ${flagName} requires a value.`);
  }

  return value;
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  runBotIpSync().then(({ exitCode }) => {
    process.exitCode = exitCode;
  });
}
