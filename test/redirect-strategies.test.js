import test from 'node:test';
import assert from 'node:assert/strict';

import { getRedirectStrategy } from '../src/strategies/index.js';

test('redirect strategy returns a 302 response', async () => {
  const strategy = getRedirectStrategy('redirect');

  assert.deepEqual(await strategy.execute('https://example.com'), {
    statusCode: 302,
    headers: { Location: 'https://example.com' },
    body: ''
  });
});

test('iframe strategy wraps the target in an iframe page', async () => {
  const strategy = getRedirectStrategy('iframe');
  const response = await strategy.execute('https://example.com');

  assert.equal(response.statusCode, 200);
  assert.match(response.headers['Content-Type'], /text\/html/);
  assert.match(response.body, /<iframe/);
  assert.match(response.body, /https:\/\/example\.com/);
});

test('loading strategy delays navigation while preserving the target URL', async () => {
  const strategy = getRedirectStrategy('loading');
  const response = await strategy.execute('https://example.com');

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /setTimeout/);
  assert.match(response.body, /https:\/\/example\.com/);
});

test('strategy factory rejects unknown redirect modes', () => {
  assert.throws(() => getRedirectStrategy('unknown'), /unsupported redirect mode/i);
});
