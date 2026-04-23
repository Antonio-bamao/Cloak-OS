import test from 'node:test';
import assert from 'node:assert/strict';

import { IpDetector } from '../src/detectors/ip.detector.js';
import { UserAgentDetector } from '../src/detectors/ua.detector.js';

test('IpDetector flags configured bot IPs without hardcoding data in business logic', async () => {
  const detector = new IpDetector({ botIps: ['66.249.66.1'] });

  assert.deepEqual(await detector.detect({ ip: '66.249.66.1' }), {
    isBot: true,
    confidence: 95,
    reason: 'IP matched configured bot source'
  });

  assert.deepEqual(await detector.detect({ ip: '203.0.113.10' }), {
    isBot: false,
    confidence: 0,
    reason: 'IP not found in bot source'
  });
});

test('UserAgentDetector flags known crawler user agents', async () => {
  const detector = new UserAgentDetector();

  assert.deepEqual(await detector.detect({ userAgent: 'Mozilla/5.0 Googlebot/2.1' }), {
    isBot: true,
    confidence: 90,
    reason: 'User-Agent matched crawler signature'
  });

  assert.deepEqual(await detector.detect({ userAgent: 'Mozilla/5.0 Chrome/123.0' }), {
    isBot: false,
    confidence: 0,
    reason: 'User-Agent did not match crawler signature'
  });
});
