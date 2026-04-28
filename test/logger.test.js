import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createLogger, createRotatingFileSink } from '../src/utils/logger.js';

test('structured logger writes level, message, timestamp, and context to its sink', () => {
  const entries = [];
  const logger = createLogger({
    sink: (entry) => entries.push(entry),
    now: () => '2026-04-23T10:05:00.000Z'
  });

  logger.info('Campaign created', {
    campaignId: 'campaign-1',
    latencyMs: 12
  });

  assert.deepEqual(entries, [
    {
      level: 'info',
      message: 'Campaign created',
      timestamp: '2026-04-23T10:05:00.000Z',
      campaignId: 'campaign-1',
      latencyMs: 12
    }
  ]);
});

test('rotating file sink writes JSON lines and keeps bounded archive files', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'cloak-logs-'));
  const logFile = path.join(directory, 'cloak.log');

  try {
    const sink = createRotatingFileSink({
      filePath: logFile,
      maxBytes: 120,
      maxFiles: 2
    });
    const logger = createLogger({
      sink,
      now: () => '2026-04-28T10:05:00.000Z'
    });

    logger.info('first request', { requestId: 'one' });
    logger.info('second request', { requestId: 'two' });
    logger.info('third request', { requestId: 'three' });

    const current = await readFile(logFile, 'utf8');
    const firstArchive = await readFile(`${logFile}.1`, 'utf8');

    assert.match(current, /"requestId":"three"/);
    assert.match(firstArchive, /"requestId":"two"/);
    await assert.rejects(() => stat(`${logFile}.2`), /ENOENT/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
