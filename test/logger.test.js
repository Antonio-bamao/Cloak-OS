import test from 'node:test';
import assert from 'node:assert/strict';

import { createLogger } from '../src/utils/logger.js';

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
