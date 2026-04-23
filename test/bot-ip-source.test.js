import test from 'node:test';
import assert from 'node:assert/strict';

import {
  InMemoryBotIpSource,
  createBotIpSource
} from '../src/detectors/bot-ip-source.js';
import { IpDetector } from '../src/detectors/ip.detector.js';

test('InMemoryBotIpSource loads and checks bot IPs through a stable source contract', async () => {
  const source = new InMemoryBotIpSource();

  await source.load(['66.249.66.1', '66.249.66.2']);

  assert.equal(await source.has('66.249.66.1'), true);
  assert.equal(await source.has('203.0.113.10'), false);
});

test('createBotIpSource creates an in-memory source from configured IPs', async () => {
  const source = createBotIpSource({
    type: 'memory',
    botIps: ['66.249.66.1']
  });

  assert.equal(await source.has('66.249.66.1'), true);
});

test('createBotIpSource rejects unsupported source types', () => {
  assert.throws(
    () => createBotIpSource({ type: 'redis' }),
    /unsupported bot ip source/i
  );
});

test('IpDetector consults a bot IP source instead of owning list data', async () => {
  const calls = [];
  const detector = new IpDetector({
    botIpSource: {
      async has(ip) {
        calls.push(ip);
        return ip === '66.249.66.1';
      }
    }
  });

  assert.deepEqual(await detector.detect({ ip: '66.249.66.1' }), {
    isBot: true,
    confidence: 95,
    reason: 'IP matched configured bot source'
  });
  assert.deepEqual(calls, ['66.249.66.1']);
});
