import test from 'node:test';
import assert from 'node:assert/strict';

import {
  InMemoryBotIpSource,
  RedisBotIpSource,
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
    () => createBotIpSource({ type: 'unknown' }),
    /unsupported bot ip source/i
  );
});

test('RedisBotIpSource checks membership through an injected Redis-like client', async () => {
  const calls = [];
  const source = new RedisBotIpSource({
    client: {
      async sIsMember(key, ip) {
        calls.push({ method: 'sIsMember', key, ip });
        return ip === '66.249.66.1';
      }
    },
    key: 'cloak:bot-ips'
  });

  assert.equal(await source.has('66.249.66.1'), true);
  assert.equal(await source.has('203.0.113.10'), false);
  assert.deepEqual(calls, [
    { method: 'sIsMember', key: 'cloak:bot-ips', ip: '66.249.66.1' },
    { method: 'sIsMember', key: 'cloak:bot-ips', ip: '203.0.113.10' }
  ]);
});

test('RedisBotIpSource loads bot IPs into a Redis set when load is available', async () => {
  const calls = [];
  const source = new RedisBotIpSource({
    client: {
      async del(key) {
        calls.push({ method: 'del', key });
      },
      async sAdd(key, values) {
        calls.push({ method: 'sAdd', key, values });
      }
    },
    key: 'cloak:bot-ips'
  });

  await source.load(['66.249.66.1', '66.249.66.2']);

  assert.deepEqual(calls, [
    { method: 'del', key: 'cloak:bot-ips' },
    {
      method: 'sAdd',
      key: 'cloak:bot-ips',
      values: ['66.249.66.1', '66.249.66.2']
    }
  ]);
});

test('createBotIpSource creates a Redis source without changing IpDetector', async () => {
  const source = createBotIpSource({
    type: 'redis',
    redisClient: {
      async sIsMember(key, ip) {
        return key === 'cloak:bot-ips' && ip === '66.249.66.1';
      }
    },
    redisKey: 'cloak:bot-ips'
  });

  assert.equal(await source.has('66.249.66.1'), true);
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
