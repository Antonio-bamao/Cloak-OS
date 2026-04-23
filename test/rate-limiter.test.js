import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryRateLimiter } from '../src/utils/rate-limiter.js';

test('InMemoryRateLimiter allows requests inside the window and rejects overflow', () => {
  const limiter = new InMemoryRateLimiter({
    limit: 2,
    windowMs: 1000,
    now: (() => {
      const times = [1000, 1001, 1002, 2001];
      return () => times.shift();
    })()
  });

  assert.deepEqual(limiter.consume('ip:1.2.3.4'), { allowed: true });
  assert.deepEqual(limiter.consume('ip:1.2.3.4'), { allowed: true });
  assert.deepEqual(limiter.consume('ip:1.2.3.4'), {
    allowed: false,
    retryAfterSeconds: 1
  });
  assert.deepEqual(limiter.consume('ip:1.2.3.4'), { allowed: true });
});
